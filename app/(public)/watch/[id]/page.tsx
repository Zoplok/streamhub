import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { ReactionBar } from '@/components/video/ReactionBar'
import { Comments } from '@/components/video/Comments'
import { WatchTracker } from '@/components/video/WatchTracker'
import { auth } from '@/lib/auth'
import { logTiming } from '@/lib/perf'

interface VideoRow {
  id: string
  title: string
  description: string | null
  hls_url: string | null
  thumbnail_url: string | null
  duration: number
  views: number
  created_at: string
  channel_id: string
  channel_name: string
  likes: number
  dislikes: number
}

export default async function WatchPage({ params }: { params: { id: string } }) {
  const startedAt = performance.now()
  const result = await db.query<VideoRow>(
    `SELECT v.id, v.title, v.description, v.hls_url, v.thumbnail_url, v.duration, v.views, v.created_at,
            v.channel_id, c.name AS channel_name,
            COALESCE(reactions.likes, 0) AS likes,
            COALESCE(reactions.dislikes, 0) AS dislikes
     FROM videos v JOIN channels c ON c.id = v.channel_id
     LEFT JOIN (
       SELECT target_id,
              CAST(SUM(CASE WHEN type='like' THEN 1 ELSE 0 END) AS SIGNED) AS likes,
              CAST(SUM(CASE WHEN type='dislike' THEN 1 ELSE 0 END) AS SIGNED) AS dislikes
       FROM reactions
       WHERE target_type='video' AND target_id=?
       GROUP BY target_id
     ) reactions ON reactions.target_id = v.id
     WHERE v.id=?`,
    [params.id, params.id]
  )
  const video = result.rows[0]
  if (!video) notFound()
  const [session] = await Promise.all([
    auth(),
    db.query('UPDATE videos SET views = views + 1 WHERE id=?', [params.id])
  ])
  logTiming(`page /watch/${params.id}`, startedAt, Number(process.env.PAGE_SLOW_RENDER_MS ?? 150))

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      {video.hls_url ? (
        <VideoPlayer src={video.hls_url} poster={video.thumbnail_url} />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-900 text-neutral-500">
          Video is still processing...
        </div>
      )}

      <h1 className="mt-4 text-2xl font-bold">{video.title}</h1>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/channel/${video.channel_id}`} className="text-sm text-neutral-300 hover:text-white">
          {video.channel_name}
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-neutral-400">{video.views.toLocaleString()} views</span>
          <ReactionBar videoId={video.id} initialLikes={video.likes} initialDislikes={video.dislikes} />
        </div>
      </div>

      {video.description && (
        <p className="mt-4 whitespace-pre-wrap rounded-lg bg-neutral-900 p-4 text-sm text-neutral-200">
          {video.description}
        </p>
      )}

      <Comments videoId={video.id} />
      {session?.user && <WatchTracker videoId={video.id} />}
    </div>
  )
}
