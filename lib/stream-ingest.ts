import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type WebSocket } from 'ws'
import ffmpegPath from 'ffmpeg-static'
import { db } from './db'

// Browser MediaRecorder → WebSocket → ffmpeg stdin → RTMP push → nginx-rtmp → HLS.
// The browser streams webm (vp8/opus or vp9/opus). ffmpeg transcodes to H.264/AAC
// and pushes to the local RTMP ingest using the stream_key. nginx-rtmp's on_publish
// webhook then flips status=live and rewrites the name to the stream UUID.

const RTMP_URL = process.env.RTMP_INGEST_URL ?? 'rtmp://127.0.0.1:1935/live'
const FFMPEG = (ffmpegPath as unknown as string) || 'ffmpeg'

interface Session {
  ws: WebSocket
  ff: ChildProcessWithoutNullStreams
  streamKey: string
  streamId: string
  bytes: number
  startedAt: number
}

const sessions = new Map<WebSocket, Session>()

function buildFfmpegArgs(rtmpName: string): string[] {
  const target = `${RTMP_URL.replace(/\/$/, '')}/${rtmpName}`
  return [
    // read webm from stdin
    '-f', 'webm',
    '-i', 'pipe:0',
    // video encode
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '3.1',
    '-g', '60',
    '-keyint_min', '60',
    '-b:v', '2500k',
    '-maxrate', '2500k',
    '-bufsize', '5000k',
    // audio encode
    '-c:a', 'aac',
    '-b:a', '128k',
    '-ar', '44100',
    '-ac', '2',
    // flush fast
    '-f', 'flv',
    '-flvflags', 'no_duration_filesize',
    target
  ]
}

function startSession(ws: WebSocket, streamKey: string, streamId: string) {
  // Push directly under the stream UUID so HLS playlists are <uuid>.m3u8 —
  // the stream key never leaves the server.
  const ff = spawn(FFMPEG, buildFfmpegArgs(streamId), {
    stdio: ['pipe', 'pipe', 'pipe']
  }) as ChildProcessWithoutNullStreams

  const session: Session = { ws, ff, streamKey, streamId, bytes: 0, startedAt: Date.now() }
  sessions.set(ws, session)

  ff.stderr.on('data', (chunk) => {
    const line = chunk.toString().trim()
    // ffmpeg is noisy; surface only errors
    if (/error|failed|invalid|connection refused/i.test(line)) {
      console.error('[ingest-ws ffmpeg]', line.slice(0, 200))
    }
  })

  ff.on('error', (err) => {
    console.error('[ingest-ws] ffmpeg spawn error:', err.message)
    try { ws.send(JSON.stringify({ type: 'error', message: 'encoder failed to start' })) } catch {}
    try { ws.close(1011, 'ffmpeg spawn error') } catch {}
  })

  ff.on('close', (code) => {
    console.log(`[ingest-ws] ffmpeg exited code=${code} stream=${streamId}`)
    if (ws.readyState === ws.OPEN) {
      try { ws.send(JSON.stringify({ type: 'ended', code })) } catch {}
      try { ws.close(1000, 'encoder ended') } catch {}
    }
    sessions.delete(ws)
  })

  ws.on('message', (data, isBinary) => {
    const s = sessions.get(ws)
    if (!s) return
    if (!isBinary) {
      // small control channel (ping, stats request, etc.)
      try {
        const msg = JSON.parse(data.toString())
        if (msg?.type === 'ping') ws.send(JSON.stringify({ type: 'pong', t: Date.now() }))
      } catch {}
      return
    }
    const buf = data as Buffer
    s.bytes += buf.length
    if (s.ff.stdin.writable) {
      s.ff.stdin.write(buf)
    }
  })

  ws.on('close', () => {
    const s = sessions.get(ws)
    if (!s) return
    console.log(`[ingest-ws] client disconnected stream=${s.streamId} bytes=${s.bytes}`)
    try { s.ff.stdin.end() } catch {}
    // give ffmpeg a moment to flush the RTMP publish-done
    setTimeout(() => { try { s.ff.kill('SIGKILL') } catch {} }, 2000)
  })

  ws.send(JSON.stringify({ type: 'ready', streamId }))
  console.log(`[ingest-ws] session started stream=${streamId}`)
}

export function attachStreamIngest(server: import('node:http').Server) {
  const wss = new WebSocketServer({ noServer: true })

  server.on('upgrade', async (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    if (url.pathname !== '/api/ws/stream') return // let other upgrade handlers (socket.io) take it

    const key = url.searchParams.get('key')?.trim()
    if (!key) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n')
      socket.destroy()
      return
    }

    try {
      const result = await db.query<{ id: string }>(
        'SELECT id FROM live_streams WHERE stream_key=? LIMIT 1',
        [key]
      )
      const row = result.rows[0]
      if (!row) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\nInvalid stream key')
        socket.destroy()
        return
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        startSession(ws, key, row.id)
      })
    } catch (err) {
      console.error('[ingest-ws] upgrade error:', err)
      socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n')
      socket.destroy()
    }
  })

  console.log('[ingest-ws] attached on /api/ws/stream')
}
