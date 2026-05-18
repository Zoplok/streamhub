import { cachedDbQuery } from '@/lib/cached-db'
import { ShortsFeed } from '@/components/shorts/ShortsFeed'
import type { Short } from '@/types'


export const revalidate = 30
interface ScoredShort extends Short {
  score: number
  channel_name: string
}

export default async function ShortsPage() {
  const result = await cachedDbQuery<ScoredShort>(
    'shorts:initial',
    `WITH candidate_shorts AS (
       SELECT id, channel_id, title, description, video_url, thumbnail_url, duration, views, created_at
       FROM shorts
       ORDER BY created_at DESC
       LIMIT 200
     ),
     scored AS (
       SELECT s.id, s.channel_id, s.title, s.description, s.video_url, s.thumbnail_url, s.duration, s.views, s.created_at,
              c.name AS channel_name,
              COALESCE(l.likes, 0) AS likes,
              COALESCE(cm.comments_count, 0) AS comments_count,
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
       LEFT JOIN (
         SELECT co.short_id, CAST(COUNT(*) AS SIGNED) AS comments_count
         FROM comments co
         JOIN candidate_shorts cs ON cs.id = co.short_id
         GROUP BY co.short_id
       ) cm ON cm.short_id = s.id
     )
     SELECT * FROM scored ORDER BY score DESC LIMIT 10`,
    [],
    30
  )
  const last = result.rows[result.rows.length - 1]
  const cursor = last ? String(last.score) : null
  return <ShortsFeed initial={result.rows} initialCursor={cursor} />
}
