import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const idSchema = z.string().uuid()

const patchSchema = z.object({
  action: z.enum(['ban', 'unban', 'promote', 'demote']),
  role: z.enum(['admin', 'moderator', 'creator', 'viewer']).optional()
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { action, role } = parsed.data

  try {
    if (action === 'ban') {
      await db.query(
        "UPDATE users SET role_id = (SELECT id FROM roles WHERE name='viewer'), password_hash='BANNED' WHERE id=?",
        [params.id]
      )
    } else if (action === 'unban') {
      return NextResponse.json({ error: 'Unban requires password reset flow' }, { status: 400 })
    } else if (action === 'promote' || action === 'demote') {
      if (!role) return NextResponse.json({ error: 'role required' }, { status: 400 })
      await db.query(
        'UPDATE users SET role_id = (SELECT id FROM roles WHERE name=?) WHERE id=?',
        [role, params.id]
      )
    }
    return NextResponse.json({ data: { id: params.id, action } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    await db.query('DELETE FROM users WHERE id=?', [params.id])
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
