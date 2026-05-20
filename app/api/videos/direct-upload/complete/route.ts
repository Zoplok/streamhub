import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateVideoCaches } from '@/lib/redis'

export const runtime = 'nodejs'

const schema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1).max(500).startsWith('originals/'),
  publicUrl: z.string().url().max(2000),
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default(''),
  category: z.string().max(50).optional().default(''),
  tags: z.string().max(500).optional().default(''),
  thumbnail_url: z.string().url().max(1000).optional().or(z.literal('')).default('')
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

  const channel = await db.query<{ id: string }>(
    'SELECT id FROM channels WHERE user_id=? LIMIT 1',
    [session.user.id]
  )
  if (!channel.rows[0]) {
    return NextResponse.json({ error: 'No channel for this user. Go to Dashboard -> Channel to create one.' }, { status: 400 })
  }

  const data = parsed.data
  const tags = data.tags.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 20)
  await db.query(
    `INSERT INTO videos (id, channel_id, title, description, category, status, tags, hls_url, thumbnail_url, duration)
     VALUES (?, ?, ?, ?, ?, 'ready', CAST(? AS JSON), ?, ?, 0)`,
    [
      data.id,
      channel.rows[0].id,
      data.title,
      data.description,
      data.category || null,
      JSON.stringify(tags),
      data.publicUrl,
      data.thumbnail_url || null
    ]
  )
  await invalidateVideoCaches()

  return NextResponse.json({ data: { id: data.id, status: 'ready' } }, { status: 201 })
}
