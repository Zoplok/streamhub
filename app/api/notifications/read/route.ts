import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const schema = z.object({
  id: z.string().uuid().optional(), // if omitted, mark all as read
  all: z.boolean().optional()
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    if (parsed.data.id) {
      await db.query(
        'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND read_at IS NULL',
        [parsed.data.id, session.user.id]
      )
    } else {
      await db.query(
        'UPDATE notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL',
        [session.user.id]
      )
    }
    return NextResponse.json({ data: { ok: true } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
