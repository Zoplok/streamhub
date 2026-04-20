import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  status: z.enum(['pending', 'resolved', 'dismissed']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0)
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'moderator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { status, limit, offset } = parsed.data
  try {
    const params: unknown[] = []
    let where = ''
    if (status) {
      params.push(status)
      where = 'WHERE r.status = ?'
    }
    params.push(limit, offset)
    const result = await db.query(
      `SELECT r.*, u.username AS reporter_username
       FROM reports r JOIN users u ON u.id = r.reporter_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    )
    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const postSchema = z.object({
  target_type: z.enum(['video', 'short', 'comment', 'user', 'stream']),
  target_id: z.string().uuid(),
  reason: z.string().min(3).max(500)
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const { randomUUID } = await import('node:crypto')
    const id = randomUUID()
    await db.query(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [id, session.user.id, parsed.data.target_type, parsed.data.target_id, parsed.data.reason]
    )
    return NextResponse.json({ data: { id } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const patchSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['resolved', 'dismissed'])
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'moderator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    await db.query('UPDATE reports SET status=? WHERE id=?', [parsed.data.status, parsed.data.id])
    return NextResponse.json({ data: { id: parsed.data.id, status: parsed.data.status } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
