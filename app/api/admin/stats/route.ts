import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  try {
    const [users, videos, streams, shorts, reports] = await Promise.all([
      db.query<{ c: number }>('SELECT CAST(COUNT(*) AS SIGNED) AS c FROM users'),
      db.query<{ c: number }>('SELECT CAST(COUNT(*) AS SIGNED) AS c FROM videos'),
      db.query<{ c: number }>("SELECT CAST(COUNT(*) AS SIGNED) AS c FROM live_streams WHERE status='live'"),
      db.query<{ c: number }>('SELECT CAST(COUNT(*) AS SIGNED) AS c FROM shorts'),
      db.query<{ c: number }>("SELECT CAST(COUNT(*) AS SIGNED) AS c FROM reports WHERE status='pending'")
    ])
    const totalViews = await db.query<{ s: number }>('SELECT CAST(COALESCE(SUM(views),0) AS SIGNED) AS s FROM videos')
    return NextResponse.json({
      data: {
        users: users.rows[0].c,
        videos: videos.rows[0].c,
        liveStreams: streams.rows[0].c,
        shorts: shorts.rows[0].c,
        pendingReports: reports.rows[0].c,
        totalViews: totalViews.rows[0].s
      }
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
