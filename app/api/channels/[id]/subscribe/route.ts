import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createNotification } from '@/lib/notifications'

const idSchema = z.string().uuid()

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    // Check first so we only send a notification for new subscriptions.
    const existed = await db.query<{ n: number }>(
      'SELECT COUNT(*) AS n FROM subscriptions WHERE subscriber_id=? AND channel_id=?',
      [session.user.id, params.id]
    )
    await db.query(
      `INSERT IGNORE INTO subscriptions (id, subscriber_id, channel_id) VALUES (?, ?, ?)`,
      [crypto.randomUUID(), session.user.id, params.id]
    )
    const wasNew = Number(existed.rows[0]?.n ?? 0) === 0
    if (wasNew) {
      try {
        const owner = await db.query<{ user_id: string; name: string }>(
          'SELECT user_id, name FROM channels WHERE id = ? LIMIT 1',
          [params.id]
        )
        if (owner.rows[0]) {
          await createNotification({
            userId: owner.rows[0].user_id,
            actorId: session.user.id,
            type: 'new_subscriber',
            title: 'New subscriber',
            body: `${session.user.name ?? 'Someone'} subscribed to ${owner.rows[0].name}.`,
            link: `/channel/${params.id}`
          })
        }
      } catch (e) {
        console.error('[notify subscribe]', e)
      }
    }
    return NextResponse.json({ data: { subscribed: true } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    await db.query(
      'DELETE FROM subscriptions WHERE subscriber_id=? AND channel_id=?',
      [session.user.id, params.id]
    )
    return NextResponse.json({ data: { subscribed: false } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ data: { subscribed: false } })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const result = await db.query(
    'SELECT 1 FROM subscriptions WHERE subscriber_id=? AND channel_id=? LIMIT 1',
    [session.user.id, params.id]
  )
  return NextResponse.json({ data: { subscribed: (result.rowCount ?? 0) > 0 } })
}
