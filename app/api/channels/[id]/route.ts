import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

const idSchema = z.string().uuid()

const patchSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  description: z.string().max(2000).optional().nullable(),
  banner_url: z.string().url().max(500).optional().nullable(),
  avatar_url: z.string().url().max(500).optional().nullable(),
  category: z.string().max(50).optional().nullable()
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Verify ownership
  const owner = await db.query<{ user_id: string }>(
    'SELECT user_id FROM channels WHERE id=? LIMIT 1',
    [params.id]
  )
  if (!owner.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (owner.rows[0].user_id !== session.user.id && session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const fields: string[] = []
  const values: unknown[] = []
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) {
      fields.push(`${k}=?`)
      values.push(v === '' ? null : v)
    }
  }
  if (fields.length === 0) {
    return NextResponse.json({ data: { id: params.id } })
  }
  values.push(params.id)
  try {
    await db.query(`UPDATE channels SET ${fields.join(', ')} WHERE id=?`, values)
    return NextResponse.json({ data: { id: params.id } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    const channel = await db.query(
      `SELECT c.*, u.username AS owner_username, u.avatar_url AS owner_avatar,
              (SELECT CAST(COUNT(*) AS SIGNED) FROM subscriptions s WHERE s.channel_id=c.id) AS subscribers
       FROM channels c JOIN users u ON u.id=c.user_id
       WHERE c.id=?`,
      [params.id]
    )
    if (!channel.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    const videos = await db.query(
      `SELECT id, title, thumbnail_url, duration, views, created_at
       FROM videos WHERE channel_id=? AND status='ready'
       ORDER BY created_at DESC LIMIT 24`,
      [params.id]
    )
    return NextResponse.json({ data: { channel: channel.rows[0], videos: videos.rows } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
