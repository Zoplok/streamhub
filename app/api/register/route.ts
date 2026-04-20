import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcrypt'
import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'

const schema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  role: z.enum(['creator', 'viewer']).default('viewer')
})

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { username, email, password, role } = parsed.data

  try {
    const dup = await db.query(
      'SELECT 1 FROM users WHERE email=? OR username=? LIMIT 1',
      [email, username]
    )
    if (dup.rowCount && dup.rowCount > 0) {
      return NextResponse.json({ error: 'Email or username already in use' }, { status: 409 })
    }

    const hash = await bcrypt.hash(password, 12)
    const userId = randomUUID()
    const result = await db.tx(async (client) => {
      await client.query(
        `INSERT INTO users (id, username, email, password_hash, role_id)
         VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name=?))`,
        [userId, username, email, hash, role]
      )
      if (role === 'creator') {
        await client.query(
          'INSERT INTO channels (id, user_id, name) VALUES (?, ?, ?)',
          [randomUUID(), userId, username]
        )
      }
      return userId
    })
    return NextResponse.json({ data: { id: result } }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
