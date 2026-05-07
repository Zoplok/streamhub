import Link from 'next/link'
import { db } from '@/lib/db'
import { VideoGrid } from '@/components/video/VideoGrid'
import { LiveCard } from '@/components/live/LiveCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Compass, Radio } from 'lucide-react'

export const dynamic = 'force-dynamic'
export const revalidate = 60

interface VideoRow {
  id: string
  title: string
  thumbnail_url: string | null
  duration: number
  views: number
  channel_name: string
  created_at: string
}

interface LiveRow {
  id: string
  title: string
  channel_name: string
  viewer_count: number
  thumbnail_url: string | null
  category: string | null
}

interface ChannelRow {
  id: string
  name: string
  avatar_url: string | null
  subscribers: number
  category: string | null
}

export default async function ExplorePage() {
  const [live, fresh, channels] = await Promise.all([
    db.query<LiveRow>(
      `SELECT ls.id, ls.title, ls.viewer_count, ls.thumbnail_url, ls.category, c.name AS channel_name
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.status='live'
       ORDER BY ls.viewer_count DESC LIMIT 6`
    ),
    db.query<VideoRow>(
      `SELECT v.id, v.title, v.thumbnail_url, v.duration, v.views, v.created_at,
              c.name AS channel_name
       FROM videos v JOIN channels c ON c.id = v.channel_id
       WHERE v.status='ready'
       ORDER BY RAND()
       LIMIT 24`
    ),
    db.query<ChannelRow>(
      `SELECT c.id, c.name, c.avatar_url, c.category,
              (SELECT CAST(COUNT(*) AS SIGNED) FROM subscriptions s WHERE s.channel_id=c.id) AS subscribers
       FROM channels c
       ORDER BY subscribers DESC
       LIMIT 8`
    )
  ])

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        icon={Compass}
        eyebrow="Discover"
        title="Explore"
        subtitle="Fresh picks, rising channels, and live streams."
        accent="violet"
      />

      {live.rows.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-center gap-2">
            <Radio className="h-4 w-4 text-red-400" />
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-neutral-300">Live now</h2>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {live.rows.map((l) => (
              <LiveCard
                key={l.id}
                id={l.id}
                title={l.title}
                channel_name={l.channel_name}
                viewer_count={Number(l.viewer_count || 0)}
                thumbnail_url={l.thumbnail_url}
                category={l.category}
              />
            ))}
          </div>
        </section>
      )}

      {channels.rows.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-neutral-300">Top channels</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {channels.rows.map((c) => {
              const initial = c.name[0]?.toUpperCase() ?? '?'
              return (
                <Link
                  key={c.id}
                  href={`/channel/${c.id}`}
                  className="group flex flex-col items-center rounded-xl border border-surface-3 bg-surface-1 p-5 text-center transition-colors hover:border-brand-500/40 hover:bg-surface-2"
                >
                  <div
                    className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-extrabold text-surface-0 ring-2 ring-surface-3"
                    style={
                      c.avatar_url
                        ? { backgroundImage: `url(${c.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : undefined
                    }
                  >
                    {!c.avatar_url && initial}
                  </div>
                  <p className="mt-3 line-clamp-1 text-sm font-semibold text-neutral-100 group-hover:text-white">
                    {c.name}
                  </p>
                  <p className="mt-0.5 text-xs text-neutral-500">
                    {Number(c.subscribers).toLocaleString()} subscribers
                  </p>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-neutral-300">Fresh picks</h2>
        <VideoGrid videos={fresh.rows} />
      </section>
    </div>
  )
}
