import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().max(100).optional()
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const isAdmin = session.user.role === 'admin'
  const isCreator = session.user.role === 'creator'
  if (!isAdmin && !isCreator) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { limit, offset, q } = parsed.data
  try {
    const params: unknown[] = []
    const where: string[] = []
    if (q) {
      const searchTerm = `%${q}%`
      params.push(searchTerm, searchTerm)
      where.push(`(u.username LIKE ? OR u.email LIKE ?)`)
    }
    if (isCreator) {
      params.push(session.user.id, session.user.id, session.user.id, session.user.id)
      where.push(`
        r.name IN ('viewer', 'creator')
        AND EXISTS (SELECT 1 FROM channels own WHERE own.user_id = ?)
        AND (
          EXISTS (
            SELECT 1
            FROM subscriptions s
            JOIN channels own ON own.id = s.channel_id
            WHERE own.user_id = ? AND s.subscriber_id = u.id
          )
          OR EXISTS (
            SELECT 1
            FROM chat_messages cm
            JOIN live_streams ls ON ls.id = cm.stream_id
            JOIN channels own ON own.id = ls.channel_id
            WHERE own.user_id = ? AND cm.user_id = u.id
          )
          OR EXISTS (
            SELECT 1
            FROM comments co
            JOIN videos v ON v.id = co.video_id
            JOIN channels own ON own.id = v.channel_id
            WHERE own.user_id = ? AND co.user_id = u.id
          )
        )
      `)
    }
    params.push(limit, offset)
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.created_at, r.name AS role
       FROM users u JOIN roles r ON r.id=u.role_id
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    )
    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
