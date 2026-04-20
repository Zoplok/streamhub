import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { runAgent } from '@/lib/ai/agent'

const schema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().default('')
})

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
      `Suggest tags for a video titled "${parsed.data.title}" with description: "${parsed.data.description}"`,
      session.user.id,
      session.user.role
    )
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'AI suggest-tags failed' }, { status: 500 })
  }
}
