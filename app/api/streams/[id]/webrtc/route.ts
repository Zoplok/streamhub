import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

const idSchema = z.string().uuid()
const signalSchema = z.object({
  viewerId: z.string().min(8).max(120),
  type: z.enum(['viewer-offer', 'host-answer']),
  payload: z.unknown()
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const role = req.nextUrl.searchParams.get('role')
  const viewerId = req.nextUrl.searchParams.get('viewerId') ?? ''
  if (role !== 'host' && role !== 'viewer') {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  try {
    if (role === 'host') {
      const result = await db.query(
        `SELECT id, viewer_id, type, payload, created_at
         FROM stream_signals
         WHERE stream_id=? AND type='viewer-offer'
         ORDER BY created_at DESC
         LIMIT 50`,
        [params.id]
      )
      return NextResponse.json({ data: result.rows })
    }

    if (!viewerId) return NextResponse.json({ error: 'Missing viewerId' }, { status: 400 })
    const result = await db.query(
      `SELECT id, viewer_id, type, payload, created_at
       FROM stream_signals
       WHERE stream_id=? AND viewer_id=? AND type='host-answer'
       ORDER BY created_at DESC
       LIMIT 1`,
      [params.id, viewerId]
    )
    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = signalSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    await db.query(
      'DELETE FROM stream_signals WHERE stream_id=? AND viewer_id=? AND type=?',
      [params.id, parsed.data.viewerId, parsed.data.type]
    )
    const id = crypto.randomUUID()
    await db.query(
      'INSERT INTO stream_signals (id, stream_id, viewer_id, type, payload) VALUES (?,?,?,?,?)',
      [id, params.id, parsed.data.viewerId, parsed.data.type, JSON.stringify(parsed.data.payload)]
    )
    return NextResponse.json({ data: { id } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
