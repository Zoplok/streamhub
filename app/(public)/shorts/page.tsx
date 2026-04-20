import { db } from '@/lib/db'
import { ShortsFeed } from '@/components/shorts/ShortsFeed'
import type { Short } from '@/types'

export const dynamic = 'force-dynamic'

interface ScoredShort extends Short {
  score: number
  channel_name: string
}

export default async function ShortsPage() {
  const result = await db.query<ScoredShort>(
    `WITH scored AS (
       SELECT s.id, s.channel_id, s.title, s.video_url, s.thumbnail_url, s.duration, s.views, s.created_at,
              c.name AS channel_name,
              (s.views * 0.3
               + (SELECT COUNT(*) FROM reactions r WHERE r.target_type='short' AND r.target_id=s.id AND r.type='like') * 0.5
               + EXP(-TIMESTAMPDIFF(SECOND, s.created_at, NOW()) / 259200.0) * 1000 * 0.2
              ) AS score
       FROM shorts s JOIN channels c ON c.id = s.channel_id
     )
     SELECT * FROM scored ORDER BY score DESC LIMIT 10`
  )
  const last = result.rows[result.rows.length - 1]
  const cursor = last ? String(last.score) : null
  return <ShortsFeed initial={result.rows} initialCursor={cursor} />
}
