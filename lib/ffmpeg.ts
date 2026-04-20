import { spawn } from 'node:child_process'
import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { uploadObject, publicUrl } from './s3'

export interface TranscodeResult {
  hlsUrl: string
  thumbnailUrl: string
  duration: number
}

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    p.stderr.on('data', (c) => (stderr += c.toString()))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${stderr}`))))
  })
}

function probeDuration(file: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      file
    ])
    let out = ''
    p.stdout.on('data', (c) => (out += c.toString()))
    p.on('error', reject)
    p.on('close', (code) => (code === 0 ? resolve(Math.round(parseFloat(out.trim()) || 0)) : reject(new Error('ffprobe failed'))))
  })
}

export async function transcodeToHls(inputPath: string, videoId: string): Promise<TranscodeResult> {
  const workDir = await mkdir(path.join(os.tmpdir(), `sh-${videoId}`), { recursive: true }).then(
    (p) => p ?? path.join(os.tmpdir(), `sh-${videoId}`)
  )
  const outDir = workDir as string
  const thumb = path.join(outDir, 'thumb.jpg')
  const playlist = path.join(outDir, 'index.m3u8')

  try {
    // thumbnail at 1s
    await run('ffmpeg', ['-y', '-ss', '1', '-i', inputPath, '-frames:v', '1', '-q:v', '3', thumb])

    // HLS with 3 renditions
    await run('ffmpeg', [
      '-y', '-i', inputPath,
      '-filter_complex',
      '[0:v]split=3[v1][v2][v3];[v1]scale=-2:360[v1o];[v2]scale=-2:720[v2o];[v3]scale=-2:1080[v3o]',
      '-map', '[v1o]', '-map', '0:a?', '-c:v:0', 'libx264', '-b:v:0', '800k', '-c:a', 'aac', '-b:a', '96k',
      '-map', '[v2o]', '-map', '0:a?', '-c:v:1', 'libx264', '-b:v:1', '2500k',
      '-map', '[v3o]', '-map', '0:a?', '-c:v:2', 'libx264', '-b:v:2', '5000k',
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', path.join(outDir, 'v%v-%03d.ts'),
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', 'v:0,a:0 v:1,a:1 v:2,a:2',
      path.join(outDir, 'v%v.m3u8')
    ]).catch(async () => {
      // fallback single-rendition if complex filter fails (e.g. no audio)
      await run('ffmpeg', [
        '-y', '-i', inputPath,
        '-c:v', 'libx264', '-c:a', 'aac',
        '-f', 'hls', '-hls_time', '6', '-hls_playlist_type', 'vod',
        '-hls_segment_filename', path.join(outDir, 'seg-%03d.ts'),
        playlist
      ])
    })

    const duration = await probeDuration(inputPath)

    // upload all generated files
    const files = await readdir(outDir)
    const prefix = `videos/${videoId}`
    for (const f of files) {
      const full = path.join(outDir, f)
      const buf = await readFile(full)
      const ct = f.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : f.endsWith('.ts')
        ? 'video/mp2t'
        : f.endsWith('.jpg')
        ? 'image/jpeg'
        : 'application/octet-stream'
      await uploadObject(`${prefix}/${f}`, buf, ct)
    }

    const masterKey = files.includes('master.m3u8') ? 'master.m3u8' : 'index.m3u8'
    return {
      hlsUrl: publicUrl(`${prefix}/${masterKey}`),
      thumbnailUrl: publicUrl(`${prefix}/thumb.jpg`),
      duration
    }
  } finally {
    await rm(outDir, { recursive: true, force: true }).catch(() => {})
  }
}
