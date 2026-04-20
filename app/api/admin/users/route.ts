import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
  q: z.string().max(100).optional()
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { limit, offset, q } = parsed.data
  try {
    const params: unknown[] = []
    let where = ''
    if (q) {
      const searchTerm = `%${q}%`
      params.push(searchTerm, searchTerm)
      where = `WHERE u.username LIKE ? OR u.email LIKE ?`
    }
    params.push(limit, offset)
    const result = await db.query(
      `SELECT u.id, u.username, u.email, u.avatar_url, u.created_at, r.name AS role
       FROM users u JOIN roles r ON r.id=u.role_id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      params
    )
    return NextResponse.json({ data: result.rows })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
