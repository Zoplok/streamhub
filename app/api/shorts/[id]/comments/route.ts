import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'
import type { Comment } from '@/types'

const idSchema = z.string().uuid()

function nestComments(rows: Comment[]) {
  const map = new Map<string, Comment>()
  const roots: Comment[] = []

  for (const row of rows) {
    map.set(row.id, { ...row, replies: [] })
  }
  for (const row of rows) {
    const node = map.get(row.id)!
    if (row.parent_id && map.has(row.parent_id)) {
      map.get(row.parent_id)!.replies!.push(node)
    } else {
      roots.push(node)
    }
  }

  return roots
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const result = await db.query<Comment>(
      `SELECT c.id, c.user_id, c.video_id, c.short_id, c.parent_id, c.content, c.created_at,
              u.username, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.short_id=?
       ORDER BY c.created_at ASC
       LIMIT 500`,
      [params.id]
    )
    return NextResponse.json({ data: nestComments(result.rows) })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const postSchema = z.object({
  content: z.string().min(1).max(2000),
  parent_id: z.string().uuid().optional()
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const sanitized = parsed.data.content.replace(/[<>]/g, '').trim()
  if (!sanitized) return NextResponse.json({ error: 'Comment cannot be empty' }, { status: 400 })

  try {
    const commentId = crypto.randomUUID()
    await db.query(
      `INSERT INTO comments (id, user_id, short_id, parent_id, content)
       VALUES (?, ?, ?, ?, ?)`,
      [commentId, session.user.id, params.id, parsed.data.parent_id ?? null, sanitized]
    )

    try {
      const ctx = await db.query<{ user_id: string; title: string; thumbnail_url: string | null }>(
        `SELECT c.user_id, s.title, s.thumbnail_url
         FROM shorts s JOIN channels c ON c.id = s.channel_id
         WHERE s.id = ? LIMIT 1`,
        [params.id]
      )
      const owner = ctx.rows[0]
      if (owner) {
        await createNotification({
          userId: owner.user_id,
          actorId: session.user.id,
          type: 'new_comment',
          title: `${session.user.name ?? 'Someone'} commented on your short`,
          body: sanitized.slice(0, 160),
          link: `/shorts#${params.id}`,
          thumbnail: owner.thumbnail_url
        })
      }
      if (parsed.data.parent_id) {
        const parent = await db.query<{ user_id: string }>(
          'SELECT user_id FROM comments WHERE id=? LIMIT 1',
          [parsed.data.parent_id]
        )
        if (parent.rows[0]) {
          await createNotification({
            userId: parent.rows[0].user_id,
            actorId: session.user.id,
            type: 'comment_reply',
            title: `${session.user.name ?? 'Someone'} replied to your comment`,
            body: sanitized.slice(0, 160),
            link: `/shorts#${params.id}`,
            thumbnail: ctx.rows[0]?.thumbnail_url ?? null
          })
        }
      }
    } catch (e) {
      console.error('[notify short comment]', e)
    }

    const created = await db.query<Comment>(
      `SELECT c.id, c.user_id, c.video_id, c.short_id, c.parent_id, c.content, c.created_at,
              u.username, u.avatar_url
       FROM comments c JOIN users u ON u.id = c.user_id
       WHERE c.id=?`,
      [commentId]
    )
    return NextResponse.json({ data: created.rows[0] }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
