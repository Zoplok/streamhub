import { notFound } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/db'
import { VideoPlayer } from '@/components/video/VideoPlayer'
import { ReactionBar } from '@/components/video/ReactionBar'
import { Comments } from '@/components/video/Comments'
import { WatchTracker } from '@/components/video/WatchTracker'
import { auth } from '@/lib/auth'

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
  const result = await db.query<VideoRow>(
    `SELECT v.id, v.title, v.description, v.hls_url, v.thumbnail_url, v.duration, v.views, v.created_at,
            v.channel_id, c.name AS channel_name,
            (SELECT CAST(COUNT(*) AS SIGNED) FROM reactions r WHERE r.target_type='video' AND r.target_id=v.id AND r.type='like') AS likes,
            (SELECT CAST(COUNT(*) AS SIGNED) FROM reactions r WHERE r.target_type='video' AND r.target_id=v.id AND r.type='dislike') AS dislikes
     FROM videos v JOIN channels c ON c.id = v.channel_id
     WHERE v.id=?`,
    [params.id]
  )
  const video = result.rows[0]
  if (!video) notFound()
  await db.query('UPDATE videos SET views = views + 1 WHERE id=?', [params.id])
  const session = await auth()

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
