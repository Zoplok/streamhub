import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

const schema = z.object({
  target_type: z.enum(['video', 'short', 'comment']),
  target_id: z.string().uuid(),
  type: z.enum(['like', 'dislike'])
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { target_type, target_id, type } = parsed.data
  try {
    await db.query(
      `INSERT INTO reactions (user_id, target_type, target_id, type)
       VALUES (?,?,?,?)
       ON DUPLICATE KEY UPDATE type = VALUES(type)`,
      [session.user.id, target_type, target_id, type]
    )

    // Notify target owner on a new like (skip dislikes).
    if (type === 'like') {
      try {
        if (target_type === 'video') {
          const r = await db.query<{ user_id: string; title: string; thumbnail_url: string | null }>(
            `SELECT c.user_id, v.title, v.thumbnail_url
             FROM videos v JOIN channels c ON c.id = v.channel_id
             WHERE v.id=? LIMIT 1`,
            [target_id]
          )
          const row = r.rows[0]
          if (row) {
            await createNotification({
              userId: row.user_id,
              actorId: session.user.id,
              type: 'new_like',
              title: `${session.user.name ?? 'Someone'} liked your video`,
              body: row.title,
              link: `/watch/${target_id}`,
              thumbnail: row.thumbnail_url
            })
          }
        } else if (target_type === 'short') {
          const r = await db.query<{ user_id: string; title: string; thumbnail_url: string | null }>(
            `SELECT c.user_id, s.title, s.thumbnail_url
             FROM shorts s JOIN channels c ON c.id = s.channel_id
             WHERE s.id=? LIMIT 1`,
            [target_id]
          )
          const row = r.rows[0]
          if (row) {
            await createNotification({
              userId: row.user_id,
              actorId: session.user.id,
              type: 'new_like',
              title: `${session.user.name ?? 'Someone'} liked your short`,
              body: row.title,
              link: `/shorts#${target_id}`,
              thumbnail: row.thumbnail_url
            })
          }
        } else if (target_type === 'comment') {
          const r = await db.query<{ user_id: string; video_id: string | null }>(
            'SELECT user_id, video_id FROM comments WHERE id=? LIMIT 1',
            [target_id]
          )
          const row = r.rows[0]
          if (row) {
            await createNotification({
              userId: row.user_id,
              actorId: session.user.id,
              type: 'new_like',
              title: `${session.user.name ?? 'Someone'} liked your comment`,
              link: row.video_id ? `/watch/${row.video_id}` : null
            })
          }
        }
      } catch (e) {
        console.error('[notify like]', e)
      }
    }

    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = schema.pick({ target_type: true, target_id: true }).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  await db.query(
    'DELETE FROM reactions WHERE user_id=? AND target_type=? AND target_id=?',
    [session.user.id, parsed.data.target_type, parsed.data.target_id]
  )
  return NextResponse.json({ data: { ok: true } })
}
