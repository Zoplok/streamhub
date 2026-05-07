import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { invalidateStreamCaches } from '@/lib/redis'
import { withApiTiming } from '@/lib/perf'

const idSchema = z.string().uuid()

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  return withApiTiming('GET /api/streams/[id]', async () => {
    if (!idSchema.safeParse(params.id).success) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }
    try {
      const result = await db.query(
        `SELECT ls.id, ls.channel_id, ls.title, ls.status, ls.viewer_count, ls.hls_url,
                ls.started_at, ls.ended_at, c.name AS channel_name, c.user_id AS channel_owner_id
         FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
         WHERE ls.id=?`,
        [params.id]
      )
      if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      return NextResponse.json({ data: result.rows[0] })
    } catch (err) {
      console.error(err)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  })
}

const patchSchema = z.object({
  status: z.enum(['idle', 'live', 'ended']),
  hls_url: z.string().url().optional()
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

  try {
    const owner = await db.query<{ user_id: string }>(
      `SELECT c.user_id FROM live_streams ls JOIN channels c ON c.id=ls.channel_id WHERE ls.id=?`,
      [params.id]
    )
    if (!owner.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (owner.rows[0].user_id !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { status, hls_url } = parsed.data
    if (status === 'live') {
      await db.query(
        "UPDATE live_streams SET status='live', started_at=CURRENT_TIMESTAMP, hls_url=COALESCE(?, hls_url) WHERE id=?",
        [hls_url ?? null, params.id]
      )
    } else if (status === 'ended') {
      await db.query(
        "UPDATE live_streams SET status='ended', ended_at=CURRENT_TIMESTAMP WHERE id=?",
        [params.id]
      )
    } else {
      await db.query("UPDATE live_streams SET status='idle' WHERE id=?", [params.id])
    }
    await invalidateStreamCaches()
    return NextResponse.json({ data: { id: params.id, status } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
