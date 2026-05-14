import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(20).default(10)
})

export async function GET(req: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }
  const { cursor, limit } = parsed.data
  try {
    // score = views*0.3 + likes*0.5 + recency*0.2 (recency = exp(-age_hours/72))
    const params: unknown[] = []
    let cursorClause = ''
    if (cursor) {
      params.push(Number(cursor))
      cursorClause = `WHERE score < ?`
    }
    params.push(limit)
    const sql = `
      WITH candidate_shorts AS (
        SELECT id, channel_id, title, video_url, thumbnail_url, duration, views, created_at
        FROM shorts
        ORDER BY created_at DESC
        LIMIT 200
      ),
      scored AS (
        SELECT s.id, s.channel_id, s.title, s.video_url, s.thumbnail_url, s.duration, s.views, s.created_at,
               c.name AS channel_name,
               COALESCE(l.likes, 0) AS likes,
               (s.views * 0.3
                + COALESCE(l.likes, 0) * 0.5
                + EXP(-TIMESTAMPDIFF(SECOND, s.created_at, NOW()) / 259200.0) * 1000 * 0.2
               ) AS score
        FROM candidate_shorts s JOIN channels c ON c.id = s.channel_id
        LEFT JOIN (
          SELECT r.target_id, CAST(COUNT(*) AS SIGNED) AS likes
          FROM reactions r
          JOIN candidate_shorts cs ON cs.id = r.target_id
          WHERE r.target_type='short' AND r.type='like'
          GROUP BY target_id
        ) l ON l.target_id = s.id
      )
      SELECT *
      FROM scored
      ${cursorClause}
      ORDER BY score DESC
      LIMIT ?
    `
    const result = await db.query(sql, params)
    const nextCursor = result.rows.length ? (result.rows[result.rows.length - 1] as { score: number }).score : null
    return NextResponse.json({ data: result.rows, nextCursor })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
