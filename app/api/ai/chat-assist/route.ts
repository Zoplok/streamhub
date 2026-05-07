import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getOpenAI, getAIModel, hasOpenAIKey } from '@/lib/ai/openai'

export const runtime = 'nodejs'

const schema = z.object({
  streamId: z.string().uuid(),
  question: z.string().min(1).max(500),
  username: z.string().max(64).optional()
})

function buildSystem(ctx: string) {
  return `You are "StreamBot", a friendly AI chat assistant inside a live stream.

CURRENT STREAM CONTEXT (always use this when answering):
${ctx}

Rules:
- ALWAYS reference the stream title / streamer / category when the question is about "this stream", "the streamer", or similar.
- Reply in 1-2 sentences, max 280 chars.
- Be helpful, warm, and never toxic. No slurs, no medical/legal advice.
- Never include URLs or @mentions.
- If the question is generic ("hi", "hello"), greet the user and briefly mention the stream title.`
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { streamId, question, username } = parsed.data

  try {
    const streamRes = await db.query<{
      title: string
      channel_name: string
      status: string
      viewer_count: number
      started_at: string | null
      category: string | null
    }>(
      `SELECT ls.title, ls.status, ls.viewer_count, ls.started_at, ls.category, c.name AS channel_name
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=? LIMIT 1`,
      [streamId]
    )
    const stream = streamRes.rows[0]
    if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 })

    const context = `Stream title: "${stream.title}"
Channel: ${stream.channel_name}
Status: ${stream.status}
Viewers: ${stream.viewer_count ?? 0}
Category: ${stream.category ?? 'none'}
Started at: ${stream.started_at ?? 'n/a'}`

    if (!hasOpenAIKey()) {
      const fallback = `Hey${username ? ` @${username}` : ''}! StreamBot here 🤖 — I'm not fully online yet. Ask the streamer about "${stream.title}" in chat!`
      return NextResponse.json({ data: { reply: fallback, fallback: true } })
    }

    const res = await getOpenAI().chat.completions.create({
      model: getAIModel(),
      temperature: 0.4,
      max_tokens: 120,
      messages: [
        { role: 'system', content: buildSystem(context) },
        { role: 'user', content: `${username ? `[${username}]: ` : ''}${question}` }
      ]
    })

    const reply = (res.choices[0]?.message.content ?? '').trim().slice(0, 280) || "I'm not sure — try asking again!"
    return NextResponse.json({ data: { reply } })
  } catch (err) {
    const e = err as { status?: number; message?: string; code?: string }
    console.error('[chat-assist] error', e.status, e.code, e.message)
    if (e.status === 429) {
      return NextResponse.json({ data: { reply: '🤖 Too many questions at once — try again in a minute.' } })
    }
    if (e.status === 401 || e.status === 403) {
      const fallback = `Hey${username ? ` @${username}` : ''}! StreamBot here 🤖 — I'm not fully online yet. Ask the streamer in chat!`
      return NextResponse.json({ data: { reply: fallback, fallback: true } })
    }
    if (e.status === 404) {
      return NextResponse.json({ data: { reply: "🤖 That model isn't available on the configured provider." } })
    }
    return NextResponse.json({ data: { reply: '🤖 Hmm, something went wrong. Try again in a sec.' } })
  }
}
