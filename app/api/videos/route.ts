import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadObject } from '@/lib/s3'
import { enqueueTranscode } from '@/lib/queue'
import { cacheKey, getJson, invalidateVideoCaches, setJson } from '@/lib/redis'
import { withApiTiming } from '@/lib/perf'

export const runtime = 'nodejs'
export const maxDuration = 300

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  channel_id: z.string().uuid().optional(),
  category: z.string().max(50).optional(),
  q: z.string().max(100).optional()
})

export async function GET(req: NextRequest) {
  return withApiTiming('GET /api/videos', async () => {
    const parsed = listSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { limit, offset, channel_id, category, q } = parsed.data
    const shouldCache = !q
    const key = cacheKey('videos:list', { limit, offset, channel_id, category })
    if (shouldCache) {
      const cached = await getJson<unknown[]>(key)
      if (cached) return NextResponse.json({ data: cached }, { headers: { 'X-Cache': 'HIT' } })
    }
    try {
      const where: string[] = ["v.status = 'ready'"]
      const params: unknown[] = []
      if (channel_id) {
        params.push(channel_id)
        where.push(`v.channel_id = ?`)
      }
      if (category) {
        params.push(category)
        where.push(`v.category = ?`)
      }
      if (q) {
        params.push(`%${q}%`, `%${q}%`)
        where.push(`(v.title LIKE ? OR v.description LIKE ?)`)
      }
      params.push(limit, offset)
      const sql = `
        SELECT v.id, v.channel_id, v.title, v.thumbnail_url,
               v.duration, v.views, v.created_at, c.name AS channel_name
        FROM videos v
        JOIN channels c ON c.id = v.channel_id
        WHERE ${where.join(' AND ')}
        ORDER BY v.created_at DESC
        LIMIT ? OFFSET ?
      `
      const result = await db.query(sql, params)
      if (shouldCache) await setJson(key, result.rows, 300)
      return NextResponse.json({ data: result.rows }, { headers: { 'X-Cache': shouldCache ? 'MISS' : 'BYPASS' } })
    } catch (err) {
      console.error(err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

const uploadSchema = z.object({
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

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }
  if (file.size > 2 * 1024 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 2GB)' }, { status: 413 })
  }

  const parsed = uploadSchema.safeParse({
    title: form.get('title'),
    description: form.get('description') ?? '',
    category: form.get('category') ?? '',
    tags: form.get('tags') ?? ''
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let _step = 'init'
  try {
    _step = 'channel-lookup'
    const channel = await db.query<{ id: string }>(
      'SELECT id FROM channels WHERE user_id=? LIMIT 1',
      [session.user.id]
    )
    if (!channel.rows[0]) {
      return NextResponse.json({ error: 'No channel for this user. Go to Dashboard → Channel to create one.' }, { status: 400 })
    }

    const videoId = randomUUID()
    const tags = parsed.data.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20)

    _step = 'read-file'
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase().slice(0, 5)

    _step = 'storage-upload'
    await uploadObject(`originals/${videoId}.${ext}`, buf, file.type || 'video/mp4')

    _step = 'tmp-write'
    const tmpDir = path.join(os.tmpdir(), 'streamhub-originals')
    await mkdir(tmpDir, { recursive: true })
    const tmpPath = path.join(tmpDir, `${videoId}.${ext}`)
    await writeFile(tmpPath, buf)

    _step = 'db-insert'
    await db.query(
      `INSERT INTO videos (id, channel_id, title, description, category, status, tags)
       VALUES (?, ?, ?, ?, ?, 'processing', CAST(? AS JSON))`,
      [
        videoId,
        channel.rows[0].id,
        parsed.data.title,
        parsed.data.description,
        parsed.data.category || null,
        JSON.stringify(tags)
      ]
    )

    enqueueTranscode({ videoId, inputPath: tmpPath })
    await invalidateVideoCaches()

    return NextResponse.json({ data: { id: videoId, status: 'processing' } }, { status: 202 })
  } catch (err) {
    console.error(`[upload] failed at step=${_step}`, err)
    const detail = process.env.NODE_ENV !== 'production' && err instanceof Error ? ` (${_step}: ${err.message})` : ''
    return NextResponse.json({ error: `Upload failed${detail}` }, { status: 500 })
  }
}
