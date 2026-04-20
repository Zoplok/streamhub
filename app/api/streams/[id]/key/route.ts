import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const idSchema = z.string().uuid()

// Returns the stream key + title to the channel owner only.
// Used by the Browser Studio to open a WS ingest session.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    const result = await db.query<{ id: string; title: string; stream_key: string; user_id: string; status: string }>(
      `SELECT ls.id, ls.title, ls.stream_key, ls.status, c.user_id
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=? LIMIT 1`,
      [params.id]
    )
    const row = result.rows[0]
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (row.user_id !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({
      data: { id: row.id, title: row.title, stream_key: row.stream_key, status: row.status }
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
