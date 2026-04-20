import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const schema = z.object({
  video_id: z.string().uuid(),
  progress_seconds: z.number().int().min(0).max(24 * 3600).default(0)
})

// Upsert a watch-history entry for (user, video). We collapse repeat views of
// the same video into a single row so the history list shows each video once,
// ordered by the most recent view.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const existing = await db.query<{ id: string }>(
      'SELECT id FROM watch_history WHERE user_id=? AND video_id=? LIMIT 1',
      [session.user.id, parsed.data.video_id]
    )
    if (existing.rows[0]) {
      await db.query(
        `UPDATE watch_history
         SET watched_at = CURRENT_TIMESTAMP,
             progress_seconds = GREATEST(progress_seconds, ?)
         WHERE id = ?`,
        [parsed.data.progress_seconds, existing.rows[0].id]
      )
    } else {
      await db.query(
        `INSERT INTO watch_history (id, user_id, video_id, progress_seconds)
         VALUES (?, ?, ?, ?)`,
        [randomUUID(), session.user.id, parsed.data.video_id, parsed.data.progress_seconds]
      )
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await db.query('DELETE FROM watch_history WHERE user_id=?', [session.user.id])
  return NextResponse.json({ data: { ok: true } })
}
