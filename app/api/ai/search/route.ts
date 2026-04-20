import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { runAgent } from '@/lib/ai/agent'

const schema = z.object({ query: z.string().min(1).max(500) })

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  try {
    const result = await runAgent(
      `Search for videos matching: ${parsed.data.query}`,
      session.user.id,
      session.user.role
    )
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'AI search failed' }, { status: 500 })
  }
}
