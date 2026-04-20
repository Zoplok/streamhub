import { db } from '../db'
import type { Role } from '@/types'
import type { ToolName } from './tools'
import { randomUUID } from 'node:crypto'

interface Context {
  userId: string
  role: Role
}

export async function executeTool(name: string, args: Record<string, unknown>, ctx: Context): Promise<unknown> {
  switch (name as ToolName) {
    case 'search_videos':
      return searchVideos(args)
    case 'get_recommendations':
      return getRecommendations(args, ctx)
    case 'moderate_comment':
      return moderateComment(args, ctx)
    case 'suggest_tags':
      return suggestTags(args)
    case 'get_trending':
      return getTrending(args)
    default:
      return { error: `Unknown tool: ${name}` }
  }
}

async function searchVideos(args: Record<string, unknown>) {
  const query = String(args.query ?? '').trim().slice(0, 200)
  const sort = (args.sort as string) ?? 'relevant'
  const limit = Math.min(25, Math.max(1, Number(args.limit ?? 10)))
  if (!query) return { results: [] }

  const orderBy =
    sort === 'newest' ? 'v.created_at DESC' : sort === 'popular' ? 'v.views DESC' : 'v.created_at DESC'

  const result = await db.query(
    `SELECT v.id, v.title, v.description, v.views, v.thumbnail_url, v.created_at, c.name AS channel_name
     FROM videos v JOIN channels c ON c.id = v.channel_id
     WHERE v.status='ready' AND (v.title LIKE ? OR v.description LIKE ?)
     ORDER BY ${orderBy}
     LIMIT ?`,
    [`%${query}%`, `%${query}%`, limit]
  )
  return { results: result.rows }
}

async function getRecommendations(args: Record<string, unknown>, ctx: Context) {
  // Enforce: users may only request recs for themselves unless admin/moderator
  const requestedId = String(args.user_id ?? '')
  if (requestedId !== ctx.userId && !['admin', 'moderator'].includes(ctx.role)) {
    return { error: 'Forbidden: cannot fetch recommendations for another user' }
  }
  const limit = Math.min(25, Math.max(1, Number(args.limit ?? 10)))

  const result = await db.query(
    `SELECT v.id, v.title, v.thumbnail_url, v.views, v.created_at, c.name AS channel_name,
            (CASE WHEN v.channel_id IN (SELECT channel_id FROM subscriptions WHERE subscriber_id = ?) THEN 1 ELSE 0 END) AS from_sub
     FROM videos v JOIN channels c ON c.id = v.channel_id
     WHERE v.status='ready'
       AND v.id NOT IN (SELECT DISTINCT video_id FROM watch_history WHERE user_id = ?)
     ORDER BY from_sub DESC, v.views DESC, v.created_at DESC
     LIMIT ?`,
    [requestedId, requestedId, limit]
  )
  return { results: result.rows }
}

async function moderateComment(args: Record<string, unknown>, ctx: Context) {
  if (!['admin', 'moderator'].includes(ctx.role)) {
    return { error: 'Forbidden: only moderators can moderate comments' }
  }
  const commentId = String(args.comment_id ?? '')
  const content = String(args.content ?? '').toLowerCase()
  const banned = ['http://', 'https://', 'buy now', 'free crypto', 'onlyfans']
  const hateTerms = ['slur1', 'slur2']
  let flagged = false
  let reason = ''
  if (hateTerms.some((t) => content.includes(t))) {
    flagged = true
    reason = 'hate speech'
  } else if (banned.filter((t) => content.includes(t)).length >= 2) {
    flagged = true
    reason = 'spam'
  } else if (content.length > 1500) {
    flagged = true
    reason = 'excessive length'
  }

  if (flagged) {
    await db.query(
      `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, status)
       VALUES (?, ?, 'comment', ?, ?, 'pending')`,
      [randomUUID(), ctx.userId, commentId, `auto-moderation: ${reason}`]
    )
  }
  return { flagged, reason: flagged ? reason : 'ok', comment_id: commentId }
}

function suggestTags(args: Record<string, unknown>) {
  const text = `${args.title ?? ''} ${args.description ?? ''}`.toLowerCase()
  const words = text.match(/[a-z]{4,}/g) ?? []
  const stop = new Set([
    'this', 'that', 'with', 'from', 'your', 'have', 'will', 'about', 'what', 'they',
    'them', 'their', 'then', 'than', 'also', 'just', 'like', 'into', 'been', 'more'
  ])
  const counts = new Map<string, number>()
  for (const w of words) {
    if (stop.has(w)) continue
    counts.set(w, (counts.get(w) ?? 0) + 1)
  }
  const tags = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([w]) => w)
  return { tags }
}

async function getTrending(args: Record<string, unknown>) {
  const hours = Math.min(168, Math.max(1, Number(args.window_hours ?? 48)))
  const limit = Math.min(25, Math.max(1, Number(args.limit ?? 10)))
  const result = await db.query(
    `SELECT v.id, v.title, v.thumbnail_url, v.views, v.created_at, c.name AS channel_name,
            (v.views * 0.3
             + (SELECT COUNT(*) FROM reactions r
                WHERE r.target_type='video' AND r.target_id=v.id AND r.type='like') * 0.5
             + EXP(-TIMESTAMPDIFF(SECOND, v.created_at, NOW()) / (? * 3600.0)) * 1000 * 0.2
            ) AS score
     FROM videos v JOIN channels c ON c.id = v.channel_id
     WHERE v.status='ready' AND v.created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
     ORDER BY score DESC
     LIMIT ?`,
    [hours, limit]
  )
  return { results: result.rows }
}
