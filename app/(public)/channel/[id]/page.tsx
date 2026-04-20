import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ChannelHeader } from '@/components/channel/ChannelHeader'
import { VideoGrid } from '@/components/video/VideoGrid'

interface ChannelRow {
  id: string
  user_id: string
  name: string
  description: string | null
  banner_url: string | null
  avatar_url: string | null
  category: string | null
  owner_username: string
  subscribers: number
  videos_count: number
}

interface VideoRow {
  id: string
  title: string
  thumbnail_url: string | null
  duration: number
  views: number
  created_at: string
  channel_name?: string
}

export default async function ChannelPage({ params }: { params: { id: string } }) {
  const session = await auth()
  const chRes = await db.query<ChannelRow>(
    `SELECT c.id, c.user_id, c.name, c.description, c.banner_url, c.avatar_url, c.category, u.username AS owner_username,
            (SELECT CAST(COUNT(*) AS SIGNED) FROM subscriptions s WHERE s.channel_id=c.id) AS subscribers,
            (SELECT CAST(COUNT(*) AS SIGNED) FROM videos v WHERE v.channel_id=c.id AND v.status='ready') AS videos_count
     FROM channels c JOIN users u ON u.id=c.user_id
     WHERE c.id=?`,
    [params.id]
  )
  const channel = chRes.rows[0]
  if (!channel) notFound()

  const vids = await db.query<VideoRow>(
    `SELECT id, title, thumbnail_url, duration, views, created_at
     FROM videos WHERE channel_id=? AND status='ready'
     ORDER BY created_at DESC LIMIT 24`,
    [params.id]
  )

  const isOwner = !!session?.user && session.user.id === channel.user_id

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <ChannelHeader
        channelId={channel.id}
        name={channel.name}
        description={channel.description}
        banner_url={channel.banner_url}
        avatar_url={channel.avatar_url}
        category={channel.category}
        owner_username={channel.owner_username}
        subscribers={Number(channel.subscribers)}
        videosCount={Number(channel.videos_count)}
        isOwner={isOwner}
      />

      {/* Tabs (static for now, visual polish) */}
      <div className="mt-8 border-b border-surface-3">
        <div className="flex gap-6 overflow-x-auto">
          {['Videos', 'Live', 'Shorts', 'About'].map((t, i) => (
            <button
              key={t}
              className={`relative px-1 py-3 text-sm font-semibold transition-colors ${
                i === 0 ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {t}
              {i === 0 && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-white" />}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <VideoGrid videos={vids.rows} />
      </div>
    </div>
  )
}
