import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { listChatMessages, sendChatMessage } from '@/lib/chat'

export const runtime = 'nodejs'

const idSchema = z.string().uuid()
const getSchema = z.object({
  after: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
})
const postSchema = z.object({
  content: z.string().min(1).max(500)
})

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const parsed = getSchema.safeParse({
    after: req.nextUrl.searchParams.get('after') ?? undefined,
    limit: req.nextUrl.searchParams.get('limit') ?? undefined
  })
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const messages = await listChatMessages(params.id, parsed.data.after, parsed.data.limit ?? 100)
    return NextResponse.json({ data: messages })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = postSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const userRes = await db.query<{ username: string }>(
      'SELECT username FROM users WHERE id=? LIMIT 1',
      [session.user.id]
    )
    const username = userRes.rows[0]?.username ?? session.user.name ?? 'User'

    const result = await sendChatMessage({
      streamId: params.id,
      userId: session.user.id,
      username,
      content: parsed.data.content
    })

    if ('blocked' in result) return NextResponse.json({ blocked: result.blocked })
    return NextResponse.json({ data: result.messages }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
