import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const patchSchema = z.object({
  avatar_url: z.string().url().max(500).nullable().optional(),
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/).optional()
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { avatar_url?: unknown; username?: unknown } | null
  const normalizedUsername = typeof body?.username === 'string' ? body.username.trim() : body?.username
  const parsed = patchSchema.safeParse({
    avatar_url: body?.avatar_url === '' ? null : body?.avatar_url,
    username: normalizedUsername === '' ? undefined : normalizedUsername
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (parsed.data.avatar_url === undefined && parsed.data.username === undefined) {
    return NextResponse.json({ error: 'No changes submitted' }, { status: 400 })
  }

  try {
    const result = await db.tx(async (client) => {
      const currentRes = await client.query<{ username: string }>(
        'SELECT username FROM users WHERE id=? LIMIT 1 FOR UPDATE',
        [session.user.id]
      )
      const current = currentRes.rows[0]
      if (!current) throw new Error('NOT_FOUND')

      const updates: string[] = []
      const values: unknown[] = []
      let usernameChanged = false

      if (parsed.data.username !== undefined && parsed.data.username !== current.username) {
        const dup = await client.query(
          'SELECT 1 FROM users WHERE username=? AND id<>? LIMIT 1',
          [parsed.data.username, session.user.id]
        )
        if (dup.rowCount > 0) throw new Error('USERNAME_TAKEN')
        updates.push('username=?')
        values.push(parsed.data.username)
        usernameChanged = true
      }

      if (parsed.data.avatar_url !== undefined) {
        updates.push('avatar_url=?')
        values.push(parsed.data.avatar_url)
      }

      if (updates.length > 0) {
        values.push(session.user.id)
        await client.query(`UPDATE users SET ${updates.join(', ')} WHERE id=?`, values)
      }

      return {
        username: parsed.data.username ?? current.username,
        avatar_url: parsed.data.avatar_url,
        requires_reauth: usernameChanged
      }
    })

    return NextResponse.json({ data: result })
  } catch (err) {
    if ((err as Error).message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if ((err as Error).message === 'USERNAME_TAKEN') {
      return NextResponse.json({ error: 'Username is already in use' }, { status: 409 })
    }
    console.error('[profile patch]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
