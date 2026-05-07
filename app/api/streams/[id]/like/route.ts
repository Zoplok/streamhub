import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  const streamId = params.id

  const countRes = await db.query<{ count: number }>(
    `SELECT CAST(COUNT(*) AS SIGNED) AS count FROM reactions WHERE target_type='stream' AND target_id=?`,
    [streamId]
  )

  let liked = false
  if (session?.user) {
    const likedRes = await db.query<{ id: string }>(
      `SELECT id FROM reactions WHERE target_type='stream' AND target_id=? AND user_id=? LIMIT 1`,
      [streamId, session.user.id]
    )
    liked = likedRes.rows.length > 0
  }

  return NextResponse.json({
    data: { count: Number(countRes.rows[0]?.count ?? 0), liked }
  })
}

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const streamId = params.id

  const existing = await db.query<{ id: string }>(
    `SELECT id FROM reactions WHERE target_type='stream' AND target_id=? AND user_id=? LIMIT 1`,
    [streamId, session.user.id]
  )

  if (existing.rows.length > 0) {
    await db.query(
      `DELETE FROM reactions WHERE target_type='stream' AND target_id=? AND user_id=?`,
      [streamId, session.user.id]
    )
  } else {
    await db.query(
      `INSERT INTO reactions (id, user_id, target_type, target_id, type) VALUES (?,?,'stream',?,'like')`,
      [randomUUID(), session.user.id, streamId]
    )
  }

  const countRes = await db.query<{ count: number }>(
    `SELECT CAST(COUNT(*) AS SIGNED) AS count FROM reactions WHERE target_type='stream' AND target_id=?`,
    [streamId]
  )

  return NextResponse.json({
    data: { liked: existing.rows.length === 0, count: Number(countRes.rows[0]?.count ?? 0) }
  })
}
