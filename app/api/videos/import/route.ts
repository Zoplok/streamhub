import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir, unlink, readFile } from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadObject } from '@/lib/s3'
import { enqueueTranscode } from '@/lib/queue'
import { invalidateVideoCaches } from '@/lib/redis'

export const runtime = 'nodejs'
export const maxDuration = 300

const VIDEO_EXTS = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.mpg', '.mpeg', '.ogg', '.m4v', '.flv']

const schema = z.object({
  url: z.string().url().max(2000),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  category: z.string().max(50).optional().default(''),
  tags: z.string().max(500).optional().default('')
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'creator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { url, title, description, category, tags: tagsStr } = parsed.data

  let fetchRes: Response
  try {
    fetchRes = await fetch(url, {
      signal: AbortSignal.timeout(30_000),
      headers: { 'User-Agent': 'StreamHub/1.0' }
    })
  } catch {
    return NextResponse.json({ error: 'Could not reach the URL. Check it is publicly accessible.' }, { status: 422 })
  }

  if (!fetchRes.ok) {
    return NextResponse.json({ error: `URL returned HTTP ${fetchRes.status}.` }, { status: 422 })
  }

  const contentType = (fetchRes.headers.get('content-type') ?? '').toLowerCase()
  const urlPathname = new URL(url).pathname.toLowerCase()
  const isVideoContentType = contentType.startsWith('video/')
  const isVideoExtension = VIDEO_EXTS.some(e => urlPathname.endsWith(e))
  if (!isVideoContentType && !isVideoExtension) {
    return NextResponse.json({ error: 'URL does not point to a video file. Use a direct video link (MP4, WebM, MOV, etc.).' }, { status: 422 })
  }

  const contentLength = Number(fetchRes.headers.get('content-length') ?? 0)
  if (contentLength > 2 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 2 GB).' }, { status: 413 })
  }

  const channel = await db.query<{ id: string }>(
    'SELECT id FROM channels WHERE user_id=? LIMIT 1',
    [session.user.id]
  )
  if (!channel.rows[0]) {
    return NextResponse.json({ error: 'No channel found for your account.' }, { status: 400 })
  }

  const videoId = randomUUID()
  const rawExt = urlPathname.split('.').pop() ?? 'mp4'
  const ext = rawExt.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'mp4'

  const tmpDir = path.join(os.tmpdir(), 'streamhub-originals')
  await mkdir(tmpDir, { recursive: true })
  const tmpPath = path.join(tmpDir, `${videoId}.${ext}`)

  try {
    if (!fetchRes.body) throw new Error('Empty response body')

    await new Promise<void>((resolve, reject) => {
      const ws = createWriteStream(tmpPath)
      ws.on('finish', resolve)
      ws.on('error', reject)
      const reader = fetchRes.body!.getReader()
      const pump = () =>
        reader.read().then(({ done, value }) => {
          if (done) { ws.end(); return }
          ws.write(value, pump as never)
        }).catch(reject)
      pump()
    })

    const buf = await readFile(tmpPath)
    await uploadObject(`originals/${videoId}.${ext}`, buf, contentType || 'video/mp4')

    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean).slice(0, 20)

    await db.query(
      `INSERT INTO videos (id, channel_id, title, description, category, status, tags)
       VALUES (?, ?, ?, ?, ?, 'processing', CAST(? AS JSON))`,
      [videoId, channel.rows[0].id, title, description, category || null, JSON.stringify(tags)]
    )

    enqueueTranscode({ videoId, inputPath: tmpPath })
    await invalidateVideoCaches()

    return NextResponse.json({ data: { id: videoId, status: 'processing' } }, { status: 202 })
  } catch (err) {
    console.error('[video/import]', err)
    await unlink(tmpPath).catch(() => {})
    return NextResponse.json({ error: 'Failed to download or process the video. Ensure the link is a direct video file URL.' }, { status: 500 })
  }
}
