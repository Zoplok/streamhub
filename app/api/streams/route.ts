import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomBytes } from 'node:crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { cacheKey, getJson, invalidateStreamCaches, setJson } from '@/lib/redis'
import { withApiTiming } from '@/lib/perf'

const createSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(50).optional().nullable(),
  thumbnail_url: z.string().url().max(1000).optional().nullable()
})

export async function GET(req: NextRequest) {
  return withApiTiming('GET /api/streams', async () => {
    const status = req.nextUrl.searchParams.get('status') ?? 'live'
    const key = cacheKey('streams:list', { status })
    if (status === 'live') {
      const cached = await getJson<unknown[]>(key)
      if (cached) return NextResponse.json({ data: cached }, { headers: { 'X-Cache': 'HIT' } })
    }
    try {
      const result = await db.query(
        `SELECT ls.id, ls.channel_id, ls.title, ls.status, ls.viewer_count, ls.hls_url, ls.thumbnail_url, ls.category, ls.started_at,
                c.name AS channel_name
         FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
         WHERE ls.status = ?
         ORDER BY ls.started_at DESC
         LIMIT 50`,
        [status]
      )
      if (status === 'live') await setJson(key, result.rows, 30)
      return NextResponse.json({ data: result.rows }, { headers: { 'X-Cache': status === 'live' ? 'MISS' : 'BYPASS' } })
    } catch (err) {
      console.error(err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'creator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const channel = await db.query<{ id: string }>(
      'SELECT id FROM channels WHERE user_id=? LIMIT 1',
      [session.user.id]
    )
    if (!channel.rows[0]) return NextResponse.json({ error: 'No channel' }, { status: 400 })

    const streamId = crypto.randomUUID()
    const streamKey = `sk_${randomBytes(24).toString('hex')}`
    await db.query(
      `INSERT INTO live_streams (id, channel_id, title, stream_key, status, category, thumbnail_url)
       VALUES (?, ?, ?, ?, 'idle', ?, ?)`,
      [
        streamId,
        channel.rows[0].id,
        parsed.data.title,
        streamKey,
        parsed.data.category ?? null,
        parsed.data.thumbnail_url ?? null
      ]
    )
    await invalidateStreamCaches()
    return NextResponse.json(
      {
        data: {
          id: streamId,
          stream_key: streamKey,
          rtmp_url: process.env.RTMP_INGEST_URL ?? 'rtmp://localhost:1935/live'
        }
      },
      { status: 201 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
