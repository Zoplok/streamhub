import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

interface UserRoleRow {
  username: string
  role_name: 'admin' | 'moderator' | 'creator' | 'viewer'
}

interface ChannelRow {
  id: string
}

export async function POST() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const result = await db.tx(async (client) => {
      const userRes = await client.query<UserRoleRow>(
        `SELECT u.username, r.name AS role_name
         FROM users u JOIN roles r ON r.id = u.role_id
         WHERE u.id=? LIMIT 1 FOR UPDATE`,
        [session.user.id]
      )
      const user = userRes.rows[0]
      if (!user) throw new Error('NOT_FOUND')

      const channelRes = await client.query<ChannelRow>(
        'SELECT id FROM channels WHERE user_id=? LIMIT 1 FOR UPDATE',
        [session.user.id]
      )

      let channelId = channelRes.rows[0]?.id ?? null
      let upgraded = false

      if (user.role_name === 'viewer') {
        await client.query(
          "UPDATE users SET role_id=(SELECT id FROM roles WHERE name='creator') WHERE id=?",
          [session.user.id]
        )
        upgraded = true
      } else if (!['creator', 'admin'].includes(user.role_name)) {
        throw new Error('FORBIDDEN')
      }

      if (!channelId) {
        channelId = randomUUID()
        await client.query(
          'INSERT INTO channels (id, user_id, name) VALUES (?, ?, ?)',
          [channelId, session.user.id, user.username]
        )
      }

      return { channelId, upgraded }
    })

    return NextResponse.json({
      data: {
        channel_id: result.channelId,
        upgraded: result.upgraded,
        requires_reauth: result.upgraded
      }
    })
  } catch (err) {
    if ((err as Error).message === 'NOT_FOUND') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if ((err as Error).message === 'FORBIDDEN') {
      return NextResponse.json({ error: 'Only viewer accounts can self-upgrade here' }, { status: 403 })
    }
    console.error('[become creator]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
