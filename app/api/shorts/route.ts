import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { uploadObject } from '@/lib/s3'

export const runtime = 'nodejs'
export const maxDuration = 120

const createSchema = z.object({
  title: z.string().min(1).max(150)
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'creator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const form = await req.formData()
  const file = form.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  if (file.size > 100 * 1024 * 1024) {
    return NextResponse.json({ error: 'Max 100MB' }, { status: 413 })
  }

  const parsed = createSchema.safeParse({ title: form.get('title') })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const channel = await db.query<{ id: string }>(
      'SELECT id FROM channels WHERE user_id=? LIMIT 1',
      [session.user.id]
    )
    if (!channel.rows[0]) return NextResponse.json({ error: 'No channel' }, { status: 400 })

    const id = randomUUID()
    const ext = (file.name.split('.').pop() ?? 'mp4').toLowerCase().slice(0, 5)
    const key = `shorts/${id}.${ext}`
    const buf = Buffer.from(await file.arrayBuffer())
    const url = await uploadObject(key, buf, file.type || 'video/mp4')

    await db.query(
      `INSERT INTO shorts (id, channel_id, title, video_url) VALUES (?,?,?,?)`,
      [id, channel.rows[0].id, parsed.data.title, url]
    )
    return NextResponse.json({ data: { id, video_url: url } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
