import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { runAgent } from '@/lib/ai/agent'

const schema = z.object({
  comment_id: z.string().uuid(),
  content: z.string().min(1).max(4000)
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'moderator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const result = await runAgent(
      `Moderate comment ${parsed.data.comment_id} with content: "${parsed.data.content}"`,
      session.user.id,
      session.user.role
    )
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'AI moderate failed' }, { status: 500 })
  }
}
