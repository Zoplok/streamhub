import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') ?? '30'), 100)
  const onlyUnread = req.nextUrl.searchParams.get('unread') === '1'

  try {
    const where = onlyUnread ? 'AND n.read_at IS NULL' : ''
    const rows = await db.query<{
      id: string
      type: string
      title: string
      body: string | null
      link: string | null
      thumbnail: string | null
      read_at: string | null
      created_at: string
      actor_id: string | null
      actor_username: string | null
      actor_avatar: string | null
    }>(
      `SELECT n.id, n.type, n.title, n.body, n.link, n.thumbnail, n.read_at, n.created_at,
              n.actor_id, u.username AS actor_username, u.avatar_url AS actor_avatar
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       WHERE n.user_id = ? ${where}
       ORDER BY n.created_at DESC
       LIMIT ?`,
      [session.user.id, limit]
    )

    const count = await db.query<{ c: number }>(
      'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL',
      [session.user.id]
    )

    return NextResponse.json({
      data: {
        items: rows.rows,
        unread: Number(count.rows[0]?.c ?? 0)
      }
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
