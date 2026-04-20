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

export const runtime = 'nodejs'
export const maxDuration = 300

const listSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  channel_id: z.string().uuid().optional(),
  q: z.string().max(100).optional()
})

export async function GET(req: NextRequest) {
  const parsed = listSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { limit, offset, channel_id, q } = parsed.data
  try {
    const where: string[] = ["v.status = 'ready'"]
    const params: unknown[] = []
    if (channel_id) {
      params.push(channel_id)
      where.push(`v.channel_id = ?`)
    }
    if (q) {
      params.push(`%${q}%`, `%${q}%`)
      where.push(`(v.title LIKE ? OR v.description LIKE ?)`)
    }
    params.push(limit, offset)
    const sql = `
      SELECT v.id, v.channel_id, v.title, v.description, v.hls_url, v.thumbnail_url,
             v.duration, v.status, v.views, v.created_at, c.name AS channel_name
      FROM videos v
      JOIN channels c ON c.id = v.channel_id
      WHERE ${where.join(' AND ')}
      ORDER BY v.created_at DESC
      LIMIT ? OFFSET ?
    `
    const result = await db.query(sql, params)
    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const uploadSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
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
    tags: form.get('tags') ?? ''
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const channel = await db.query<{ id: string }>(
      'SELECT id FROM channels WHERE user_id=? LIMIT 1',
      [session.user.id]
    )
    if (!channel.rows[0]) {
      return NextResponse.json({ error: 'No channel for this user' }, { status: 400 })
    }

    const videoId = randomUUID()
    const tags = parsed.data.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20)

    // Persist original to S3 (kept for reprocessing) and save to a tmp path for ffmpeg
    const buf = Buffer.from(await file.arrayBuffer())
    const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase().slice(0, 5)
    await uploadObject(`originals/${videoId}.${ext}`, buf, file.type || 'application/octet-stream')

    const tmpDir = path.join(os.tmpdir(), 'streamhub-originals')
    await mkdir(tmpDir, { recursive: true })
    const tmpPath = path.join(tmpDir, `${videoId}.${ext}`)
    await writeFile(tmpPath, buf)

    await db.query(
      `INSERT INTO videos (id, channel_id, title, description, status, tags)
       VALUES (?, ?, ?, ?, 'processing', CAST(? AS JSON))`,
      [videoId, channel.rows[0].id, parsed.data.title, parsed.data.description, JSON.stringify(tags)]
    )

    enqueueTranscode({ videoId, inputPath: tmpPath })

    return NextResponse.json({ data: { id: videoId, status: 'processing' } }, { status: 202 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
