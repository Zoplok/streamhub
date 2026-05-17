import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { ChannelHeader } from '@/components/channel/ChannelHeader'
import { VideoGrid } from '@/components/video/VideoGrid'
import { LiveCard } from '@/components/live/LiveCard'
import Link from 'next/link'
import { Film } from 'lucide-react'

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
  created_at: string
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

interface LiveRow {
  id: string
  title: string
  viewer_count: number
  thumbnail_url: string | null
  category: string | null
  channel_name: string
}

interface ShortRow {
  id: string
  title: string
  thumbnail_url: string | null
  views: number
  channel_name: string
}

type Tab = 'videos' | 'live' | 'shorts' | 'about'

interface TabItem {
  key: Tab
  label: string
  href: string
}

function normalizeTab(v: unknown): Tab {
  const s = typeof v === 'string' ? v.toLowerCase() : ''
  if (s === 'live' || s === 'shorts' || s === 'about') return s
  return 'videos'
}

export default async function ChannelPage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams?: { [key: string]: string | string[] | undefined }
}) {
  const session = await auth()
  const tab = normalizeTab(searchParams?.tab)
  const chRes = await db.query<ChannelRow>(
    `SELECT c.id, c.user_id, c.name, c.description, c.banner_url, c.avatar_url, c.category, c.created_at, u.username AS owner_username,
            COALESCE(subs.subscribers, 0) AS subscribers,
            COALESCE(vids.videos_count, 0) AS videos_count
     FROM channels c JOIN users u ON u.id=c.user_id
     LEFT JOIN (
       SELECT channel_id, CAST(COUNT(*) AS SIGNED) AS subscribers
       FROM subscriptions
       GROUP BY channel_id
     ) subs ON subs.channel_id = c.id
     LEFT JOIN (
       SELECT channel_id, CAST(COUNT(*) AS SIGNED) AS videos_count
       FROM videos
       WHERE status='ready'
       GROUP BY channel_id
     ) vids ON vids.channel_id = c.id
     WHERE c.id=?`,
    [params.id]
  )
  const channel = chRes.rows[0]
  if (!channel) notFound()

  const [vids, live, shorts] = await Promise.all([
    tab === 'videos'
      ? db.query<VideoRow>(
          `SELECT id, title, thumbnail_url, duration, views, created_at
           FROM videos WHERE channel_id=? AND status='ready'
           ORDER BY created_at DESC LIMIT 24`,
          [params.id]
        )
      : Promise.resolve({ rows: [], rowCount: 0 }),
    tab === 'live'
      ? db.query<LiveRow>(
          `SELECT ls.id, ls.title, ls.viewer_count, ls.thumbnail_url, ls.category, c.name AS channel_name
           FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
           WHERE ls.channel_id=? AND ls.status='live'
           ORDER BY ls.viewer_count DESC LIMIT 12`,
          [params.id]
        )
      : Promise.resolve({ rows: [], rowCount: 0 }),
    tab === 'shorts'
      ? db.query<ShortRow>(
          `SELECT s.id, s.title, s.thumbnail_url, s.views, c.name AS channel_name
           FROM shorts s JOIN channels c ON c.id = s.channel_id
           WHERE s.channel_id=?
           ORDER BY s.created_at DESC LIMIT 24`,
          [params.id]
        )
      : Promise.resolve({ rows: [], rowCount: 0 })
  ])

  const isOwner = !!session?.user && session.user.id === channel.user_id
  const base = `/channel/${channel.id}`
  const tabs: TabItem[] = [
    { key: 'videos', label: 'Videos', href: base },
    { key: 'live', label: 'Live', href: `${base}?tab=live` },
    { key: 'shorts', label: 'Shorts', href: `${base}?tab=shorts` },
    { key: 'about', label: 'About', href: `${base}?tab=about` }
  ]

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

      {/* Tabs */}
      <div className="mt-8 border-b border-surface-3">
        <div className="flex gap-6 overflow-x-auto">
          {tabs.map((t) => {
            const active = t.key === tab
            return (
              <Link
                key={t.key}
                href={t.href}
                className={`relative px-1 py-3 text-sm font-semibold transition-colors ${
                  active ? 'text-white' : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {t.label}
                {active && <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-white" />}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="mt-6">
        {tab === 'videos' && (
          vids.rows.length > 0 ? (
            <VideoGrid videos={vids.rows} />
          ) : (
            <div className="rounded-2xl border border-surface-3 bg-surface-1 p-10 text-center text-neutral-400">
              No videos yet.
            </div>
          )
        )}

        {tab === 'live' && (
          live.rows.length > 0 ? (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5">
              {live.rows.map((s) => (
                <LiveCard
                  key={s.id}
                  id={s.id}
                  title={s.title}
                  channel_name={s.channel_name}
                  viewer_count={Number(s.viewer_count || 0)}
                  thumbnail_url={s.thumbnail_url}
                  category={s.category}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-surface-3 bg-surface-1 p-10 text-center text-neutral-400">
              Not live right now.
            </div>
          )
        )}

        {tab === 'shorts' && (
          shorts.rows.length > 0 ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {shorts.rows.map((s) => (
                <Link
                  key={s.id}
                  href={`/shorts#${s.id}`}
                  className="group relative aspect-[9/16] overflow-hidden rounded-xl bg-surface-2 ring-1 ring-surface-3 transition-transform hover:-translate-y-0.5"
                >
                  {s.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.thumbnail_url} alt={s.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-pink-500/40 via-brand-500/30 to-surface-2">
                      <Film className="h-8 w-8 text-white/70" />
                    </div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2">
                    <p className="line-clamp-2 text-xs font-semibold text-white">{s.title}</p>
                    <p className="text-[10px] text-neutral-300">{Number(s.views).toLocaleString()} views</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-surface-3 bg-surface-1 p-10 text-center text-neutral-400">
              No shorts yet.
            </div>
          )
        )}

        {tab === 'about' && (
          <div className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
            <h2 className="text-base font-bold text-neutral-100">About</h2>
            <p className="mt-2 whitespace-pre-line text-sm text-neutral-300">
              {channel.description?.trim() ? channel.description : 'No channel description yet.'}
            </p>
            <div className="mt-4 text-xs text-neutral-500">
              Joined {new Date(channel.created_at).toLocaleDateString()}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
