import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const patchSchema = z.object({
  avatar_url: z.string().url().max(500).nullable().optional()
})

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null) as { avatar_url?: unknown } | null
  const parsed = patchSchema.safeParse({
    avatar_url: body?.avatar_url === '' ? null : body?.avatar_url
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  if (parsed.data.avatar_url === undefined) {
    return NextResponse.json({ error: 'No changes submitted' }, { status: 400 })
  }

  try {
    await db.query('UPDATE users SET avatar_url=? WHERE id=?', [parsed.data.avatar_url, session.user.id])
    return NextResponse.json({ data: { avatar_url: parsed.data.avatar_url } })
  } catch (err) {
    console.error('[profile patch]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
