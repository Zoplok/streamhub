import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getOpenAI, getAIModel, hasOpenAIKey, isNativeOpenAI } from '@/lib/ai/openai'

export const runtime = 'nodejs'

const schema = z.object({
  query: z.string().min(1).max(200)
})

const SYSTEM = `You expand short search queries into richer keyword sets for a video platform.
Return strict JSON: {"expansions": string[], "intent": "video"|"live"|"short"|"channel"|"any", "categories": string[]}
- expansions: 4-8 alternative phrasings / related keywords, each 1-4 words, lowercase, no punctuation
- categories: 0-3 of (gaming, music, film, sports, news, irl, cooking, tech, education)
- Do not invent topics not implied by the query.`

interface Expansion {
  expansions: string[]
  intent: string
  categories: string[]
}

async function expandQuery(q: string): Promise<Expansion> {
  if (!hasOpenAIKey()) {
    const words = q.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
    return { expansions: Array.from(new Set(words)).slice(0, 6), intent: 'any', categories: [] }
  }
  try {
    const res = await getOpenAI().chat.completions.create({
      model: getAIModel(),
      temperature: 0.2,
      max_tokens: 250,
      // response_format json_object only on native OpenAI + Gemini OpenAI-compat
      ...(isNativeOpenAI() || (process.env.OPENAI_BASE_URL ?? '').includes('generativelanguage')
        ? { response_format: { type: 'json_object' as const } }
        : {}),
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: q }
      ]
    })
    const json = JSON.parse(res.choices[0]?.message.content ?? '{}') as Partial<Expansion>
    return {
      expansions: Array.isArray(json.expansions) ? json.expansions.map(String).slice(0, 8) : [],
      intent: typeof json.intent === 'string' ? json.intent : 'any',
      categories: Array.isArray(json.categories) ? json.categories.map(String).slice(0, 3) : []
    }
  } catch {
    return { expansions: [], intent: 'any', categories: [] }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const q = parsed.data.query.trim()

  try {
    const exp = await expandQuery(q)
    const terms = Array.from(new Set([q, ...exp.expansions].map((t) => t.toLowerCase().trim()).filter(Boolean))).slice(0, 8)

    // Build a dynamic LIKE OR query with scoring by match count
    if (terms.length === 0) return NextResponse.json({ data: { videos: [], channels: [], expansions: [], intent: exp.intent } })

    const likeParams = terms.map((t) => `%${t}%`)
    // Each match in title +3, description +1, channel name +2 — built in SQL with SUM(CASE WHEN ...)
    const scoreExprs = terms
      .map(() => `(CASE WHEN v.title LIKE ? THEN 3 ELSE 0 END) + (CASE WHEN v.description LIKE ? THEN 1 ELSE 0 END) + (CASE WHEN c.name LIKE ? THEN 2 ELSE 0 END)`)
      .join(' + ')
    const whereExprs = terms.map(() => `(v.title LIKE ? OR v.description LIKE ? OR c.name LIKE ?)`).join(' OR ')
    // SQL arg order: score (title, desc, channel) per term × N, where (title, desc, channel) per term × N
    const args: unknown[] = []
    for (const p of likeParams) args.push(p, p, p)
    for (const p of likeParams) args.push(p, p, p)

    const sql = `
      SELECT v.id, v.title, v.description, v.thumbnail_url, v.duration, v.views, v.created_at,
             c.id AS channel_id, c.name AS channel_name,
             (${scoreExprs}) AS score
      FROM videos v JOIN channels c ON c.id = v.channel_id
      WHERE v.status='ready' AND (${whereExprs})
      ORDER BY score DESC, v.views DESC
      LIMIT 40
    `
    const [videosRes, channelsRes] = await Promise.all([
      db.query(sql, args),
      db.query(
        `SELECT c.id, c.name, c.avatar_url, c.description,
                (SELECT CAST(COUNT(*) AS SIGNED) FROM subscriptions s WHERE s.channel_id=c.id) AS subscribers
         FROM channels c
         WHERE c.name LIKE ? OR c.description LIKE ?
         LIMIT 8`,
        [`%${q}%`, `%${q}%`]
      )
    ])

    return NextResponse.json({
      data: {
        videos: videosRes.rows,
        channels: channelsRes.rows,
        expansions: exp.expansions,
        categories: exp.categories,
        intent: exp.intent
      }
    })
  } catch (err) {
    console.error('semantic-search error', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
