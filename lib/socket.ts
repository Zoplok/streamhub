import { Server as IOServer } from 'socket.io'
import type { Server as HttpServer } from 'node:http'
import { db } from './db'
import { randomUUID } from 'node:crypto'
import { moderateText } from './ai/moderation'
import { getOpenAI, getAIModel, hasOpenAIKey } from './ai/openai'

let io: IOServer | null = null

const BOT_USER_ID = '00000000-0000-0000-0000-0000000000b0'
const BOT_NAME = 'StreamBot'

async function callBotLLM(ctx: string, question: string, asker?: string): Promise<string> {
  const system = `You are "StreamBot", a friendly AI chat assistant inside a live stream.

CURRENT STREAM CONTEXT (always use this when answering):
${ctx}

Rules:
- ALWAYS reference the stream title / streamer / category when the question is about "this stream", "the streamer", or similar.
- Reply in 1-2 sentences, max 240 chars.
- Be helpful, warm, and never toxic. No slurs, no medical/legal advice.
- Never include URLs or @mentions.
- If the question is generic ("hi", "hello"), greet the asker and mention the stream title briefly.`

  const userMsg = asker ? `[${asker}]: ${question}` : question

  const res = await getOpenAI().chat.completions.create({
    model: getAIModel(),
    temperature: 0.5,
    max_tokens: 140,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg }
    ]
  })
  return (res.choices[0]?.message.content ?? '').trim()
}

async function askBot(streamId: string, question: string, asker?: string): Promise<string> {
  let stream: { title: string; channel_name: string; viewer_count: number; category: string | null } | undefined
  try {
    const streamRes = await db.query<{
      title: string
      channel_name: string
      status: string
      viewer_count: number
      category: string | null
    }>(
      `SELECT ls.title, ls.status, ls.viewer_count, ls.category, c.name AS channel_name
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=? LIMIT 1`,
      [streamId]
    )
    stream = streamRes.rows[0]
  } catch (err) {
    console.error('[StreamBot] stream lookup failed', err)
  }

  const ctx = stream
    ? `Stream: "${stream.title}" by ${stream.channel_name} · ${stream.viewer_count} viewers · category: ${stream.category ?? 'n/a'}`
    : 'No stream info.'

  if (!hasOpenAIKey()) {
    return `🤖 StreamBot is sleeping — set OPENAI_API_KEY in .env to wake me up!`
  }

  // Try once; on 429 retry after a short backoff; otherwise return a friendly note.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callBotLLM(ctx, question, asker)
      if (!text) return "🤖 I didn't catch that — try rephrasing?"
      return text.slice(0, 240)
    } catch (err) {
      const e = err as { status?: number; message?: string; code?: string }
      console.error(`[StreamBot] LLM error (attempt ${attempt + 1})`, e.status, e.code, e.message)
      if (e.status === 429 && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500))
        continue
      }
      if (e.status === 429) return '🤖 Too many questions at once — give me a minute to cool down.'
      if (e.status === 401 || e.status === 403) return '🤖 My API key was rejected. Ask an admin to check the AI config.'
      if (e.status === 404) return '🤖 That model doesn\'t exist on the configured provider — check OPENAI_MODEL.'
      if ((e.message ?? '').includes('ENOTFOUND') || (e.message ?? '').includes('ECONNREFUSED')) {
        return '🤖 Can\'t reach the AI provider right now.'
      }
      return '🤖 Hmm, something went wrong. Try again in a sec.'
    }
  }
  return '🤖 Brain freeze — try again in a moment.'
}

export function initSocket(httpServer: HttpServer): IOServer {
  if (io) return io
  io = new IOServer(httpServer, {
    cors: { origin: process.env.NEXTAUTH_URL ?? '*', credentials: true },
    path: '/api/socket'
  })

  io.on('connection', (socket) => {
    socket.on('stream:join', async (streamId: string) => {
      if (typeof streamId !== 'string') return
      socket.join(`stream:${streamId}`)
      const count = io!.sockets.adapter.rooms.get(`stream:${streamId}`)?.size ?? 0
      io!.to(`stream:${streamId}`).emit('stream:viewers', count)
      await db
        .query('UPDATE live_streams SET viewer_count=? WHERE id=?', [count, streamId])
        .catch(() => {})
    })

    socket.on('stream:leave', async (streamId: string) => {
      socket.leave(`stream:${streamId}`)
      const count = io!.sockets.adapter.rooms.get(`stream:${streamId}`)?.size ?? 0
      io!.to(`stream:${streamId}`).emit('stream:viewers', count)
      await db
        .query('UPDATE live_streams SET viewer_count=? WHERE id=?', [count, streamId])
        .catch(() => {})
    })

    socket.on(
      'chat:send',
      async (payload: { streamId: string; userId: string; username: string; content: string }) => {
        const { streamId, userId, username, content } = payload ?? {}
        if (!streamId || !userId || !content || content.length > 500) return
        const sanitized = content.replace(/[<>]/g, '').slice(0, 500)

        // AI moderation
        const mod = await moderateText(sanitized)
        if (mod.severity === 'block') {
          socket.emit('chat:blocked', {
            reason: mod.reason ?? 'blocked by moderation',
            categories: mod.categories
          })
          return
        }

        const id = randomUUID()
        await db
          .query(
            'INSERT INTO chat_messages (id, stream_id, user_id, content) VALUES (?,?,?,?)',
            [id, streamId, userId, sanitized]
          )
          .catch(() => {})
        io!.to(`stream:${streamId}`).emit('chat:message', {
          id,
          stream_id: streamId,
          user_id: userId,
          username,
          content: sanitized,
          created_at: new Date().toISOString(),
          flagged: mod.severity === 'warn' ? (mod.reason ?? 'flagged') : undefined
        })

        // @streambot assistant
        const match = sanitized.match(/^@streambot\b[:,]?\s*(.*)$/i)
        if (match) {
          const question = match[1].trim() || 'Say hi to the chat.'
          const reply = await askBot(streamId, question, username)
          const botMsgId = randomUUID()
          io!.to(`stream:${streamId}`).emit('chat:message', {
            id: botMsgId,
            stream_id: streamId,
            user_id: BOT_USER_ID,
            username: BOT_NAME,
            content: reply,
            created_at: new Date().toISOString(),
            bot: true
          })
        }
      }
    )
  })

  return io
}

export function getIO(): IOServer | null {
  return io
}
