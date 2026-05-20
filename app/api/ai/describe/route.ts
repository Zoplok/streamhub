import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { getOpenAI, getAIModel, hasOpenAIKey, isNativeOpenAI } from '@/lib/ai/openai'

export const runtime = 'nodejs'

const schema = z.object({
  title: z.string().min(2).max(200),
  category: z.string().max(80).optional().nullable(),
  hints: z.string().max(600).optional().nullable(),
  mode: z.enum(['video', 'short', 'stream']).default('video'),
  tone: z.enum(['hype', 'friendly', 'informative', 'minimal']).default('friendly')
})

const SYSTEM = `You write punchy YouTube/Twitch-style video descriptions.
Rules:
- Output valid JSON only. No prose outside the JSON.
- JSON shape: {"description": string, "tags": string[], "hashtags": string[], "chapters": [{"time":"mm:ss","label":string}] | null, "category": string|null}
- Description: 2-4 short paragraphs, first paragraph is a hook (<=180 chars).
- Use emojis sparingly (0-3). Never use hate, slurs, or clickbait lies.
- tags: 8-12 lowercase keywords, no '#'.
- hashtags: 3-6 camelCase with leading '#'.
- chapters: optional, only if the title hints at sections (otherwise null).`

function localDescription({
  title,
  category,
  mode
}: {
  title: string
  category?: string | null
  mode: 'video' | 'short' | 'stream'
}) {
  const words = title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
  const tags = Array.from(new Set([...(category ? [category.toLowerCase()] : []), ...words])).slice(0, 10)

  return {
    description:
      `${title}.\n\nIn this ${mode === 'short' ? 'short' : mode}, we dive into ${title.toLowerCase()} - what matters, why it matters, and what you should take away.\n\nLike & subscribe for more.`,
    tags,
    hashtags: tags.slice(0, 4).map((tag) => `#${tag.replace(/(^.|\s+.)/g, (match) => match.trim().toUpperCase())}`),
    chapters: null,
    category: category ?? null,
    fallback: true
  }
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
  } catch {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      const parsed = JSON.parse(match[0])
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
    } catch {
      return null
    }
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'creator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { title, category, hints, mode, tone } = parsed.data

  if (!hasOpenAIKey()) {
    return NextResponse.json({ data: localDescription({ title, category, mode }) })
  }

  try {
    const client = getOpenAI()
    const prompt = `Title: ${title}
Type: ${mode}
Tone: ${tone}
${category ? `Category: ${category}` : ''}
${hints ? `Creator hints: ${hints}` : ''}

Write the description JSON now.`

    const res = await client.chat.completions.create({
      model: getAIModel(),
      temperature: 0.7,
      max_tokens: 800,
      ...(isNativeOpenAI() || (process.env.OPENAI_BASE_URL ?? '').includes('generativelanguage')
        ? { response_format: { type: 'json_object' as const } }
        : {}),
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt }
      ]
    })

    const raw = res.choices[0]?.message.content ?? '{}'
    const json = parseJsonObject(raw)
    if (!json) {
      return NextResponse.json({ data: localDescription({ title, category, mode }) })
    }

    return NextResponse.json({
      data: {
        description: String(json.description ?? '').trim(),
        tags: Array.isArray(json.tags) ? (json.tags as unknown[]).map(String).slice(0, 12) : [],
        hashtags: Array.isArray(json.hashtags) ? (json.hashtags as unknown[]).map(String).slice(0, 6) : [],
        chapters: Array.isArray(json.chapters) ? json.chapters : null,
        category: typeof json.category === 'string' ? json.category : category ?? null
      }
    })
  } catch (err) {
    const e = err as { status?: number; message?: string }
    console.error('AI describe error', e.status, e.message)
    if (e.status === 401 || e.status === 403) {
      return NextResponse.json(
        { error: 'AI provider rejected the API key. Check OPENAI_API_KEY / OPENAI_BASE_URL in .env.' },
        { status: 401 }
      )
    }
    return NextResponse.json({ data: localDescription({ title, category, mode }) })
  }
}
