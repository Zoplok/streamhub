import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { runAgent } from '@/lib/ai/agent'

export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const result = await runAgent(
      `Recommend videos for user ${session.user.id}.`,
      session.user.id,
      session.user.role
    )
    return NextResponse.json({ data: result })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'AI recommend failed' }, { status: 500 })
  }
}
