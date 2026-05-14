import Link from 'next/link'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { VideoGrid } from '@/components/video/VideoGrid'
import { StatsCard } from '@/components/admin/StatsCard'
import { Button } from '@/components/ui/Button'
import { Video, Eye, Users, Radio, Upload, Sparkles, TrendingUp, Film, ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'
export default async function DashboardPage() {
  const session = await auth()
  if (!session?.user) return null

  const channelRes = await db.query<{ id: string; name: string; description: string | null; created_at: string }>(
    'SELECT id, name, description, created_at FROM channels WHERE user_id=? LIMIT 1',
    [session.user.id]
  )
  const channel = channelRes.rows[0]

  let videos: {
    id: string
    title: string
    thumbnail_url: string | null
    duration: number
    views: number
    created_at: string
  }[] = []
  let topVideo: { id: string; title: string; views: number; thumbnail_url: string | null } | null = null
  let liveNow: { id: string; title: string; viewer_count: number }[] = []
  let totals = { videos: 0, views: 0, subscribers: 0, live: 0 }

  if (channel) {
    const [vids, totalRes, topRes, liveRes] = await Promise.all([
      db.query(
        `SELECT id, title, thumbnail_url, duration, views, created_at
         FROM videos WHERE channel_id=?
         ORDER BY created_at DESC LIMIT 24`,
        [channel.id]
      ),
      db.query<{ vcount: number; vviews: number; subs: number; live: number }>(
        `SELECT
           (SELECT CAST(COUNT(*) AS SIGNED) FROM videos WHERE channel_id=?) AS vcount,
           (SELECT CAST(COALESCE(SUM(views),0) AS SIGNED) FROM videos WHERE channel_id=?) AS vviews,
           (SELECT CAST(COUNT(*) AS SIGNED) FROM subscriptions WHERE channel_id=?) AS subs,
           (SELECT CAST(COUNT(*) AS SIGNED) FROM live_streams WHERE channel_id=? AND status='live') AS live`,
        [channel.id, channel.id, channel.id, channel.id]
      ),
      db.query<{ id: string; title: string; views: number; thumbnail_url: string | null }>(
        `SELECT id, title, views, thumbnail_url FROM videos WHERE channel_id=?
         ORDER BY views DESC LIMIT 1`,
        [channel.id]
      ),
      db.query<{ id: string; title: string; viewer_count: number }>(
        `SELECT id, title, viewer_count FROM live_streams
         WHERE channel_id=? AND status='live' ORDER BY started_at DESC`,
        [channel.id]
      )
    ])
    videos = vids.rows as typeof videos
    totals = {
      videos: Number(totalRes.rows[0]?.vcount ?? 0),
      views: Number(totalRes.rows[0]?.vviews ?? 0),
      subscribers: Number(totalRes.rows[0]?.subs ?? 0),
      live: Number(totalRes.rows[0]?.live ?? 0)
    }
    topVideo = topRes.rows[0] ?? null
    liveNow = liveRes.rows
  }

  const initial = session.user.name?.[0]?.toUpperCase() ?? 'U'

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-6 md:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-surface-3 bg-gradient-to-br from-surface-1 via-surface-1 to-brand-500/5 p-4 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-extrabold text-surface-0 shadow-glow">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Creator Studio</p>
            <h1 className="mt-0.5 break-words text-xl font-extrabold tracking-tight sm:text-2xl md:text-3xl">
              Welcome back, {session.user.name}
            </h1>
            {channel ? (
              <p className="mt-1 text-sm text-neutral-400">
                Managing <span className="font-semibold text-neutral-200">{channel.name}</span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-neutral-400">You don&apos;t have a creator channel yet.</p>
            )}
          </div>
        </div>
        {channel && (
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Link href="/upload">
              <Button variant="primary" size="md" className="gap-2">
                <Upload className="h-4 w-4" />
                Upload video
              </Button>
            </Link>
            <Link href="/upload/short">
              <Button variant="secondary" size="md" className="gap-2">
                <Film className="h-4 w-4" />
                Upload short
              </Button>
            </Link>
            <Link href="/go-live">
              <Button variant="danger" size="md" className="gap-2">
                <Radio className="h-4 w-4" />
                Go live
              </Button>
            </Link>
            <Link href="/dashboard/moderators">
              <Button variant="secondary" size="md" className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                Moderators
              </Button>
            </Link>
            <Link href="/dashboard/channel">
              <Button variant="outline" size="md">Customize</Button>
            </Link>
            <Link href={`/channel/${channel.id}`}>
              <Button variant="ghost" size="md">View channel</Button>
            </Link>
          </div>
        )}
      </div>

      {!channel ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-3 bg-surface-1 py-20 text-center">
          <Sparkles className="mb-3 h-8 w-8 text-brand-500" />
          <p className="text-sm font-medium text-neutral-300">No creator channel</p>
          <p className="mt-1 max-w-sm text-xs text-neutral-500">
            Ask an admin to upgrade your account to creator, or sign up again with the Creator role to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="mb-8 grid grid-cols-[repeat(auto-fit,minmax(min(100%,10rem),1fr))] gap-3 sm:gap-4">
            <StatsCard label="Videos" value={totals.videos} icon={Video} accent="brand" />
            <StatsCard
              label="Total views"
              value={totals.views}
              icon={Eye}
              accent="blue"
              delta={totals.videos ? `avg ${Math.round(totals.views / Math.max(totals.videos, 1)).toLocaleString()} per video` : undefined}
            />
            <StatsCard label="Subscribers" value={totals.subscribers} icon={Users} accent="amber" />
            <StatsCard
              label="Live now"
              value={totals.live}
              icon={Radio}
              accent="red"
              delta={totals.live ? 'You are live!' : 'No active streams'}
            />
          </div>

          {/* Live + Top video */}
          <div className="mb-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="min-w-0 rounded-xl border border-surface-3 bg-surface-1 p-4 sm:p-5 lg:col-span-2">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/15 ring-1 ring-red-600/30">
                  <Radio className="h-4 w-4 text-red-400" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Live streams</h2>
              </div>
              {liveNow.length === 0 ? (
                <p className="text-sm text-neutral-500">You have no active streams. Click <span className="text-neutral-300">Go live</span> to start one.</p>
              ) : (
                <ul className="divide-y divide-surface-3">
                  {liveNow.map((l) => (
                    <li key={l.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white animate-live-pulse">
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                          Live
                        </span>
                        <span className="truncate text-sm font-medium text-neutral-100">{l.title}</span>
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:justify-start">
                        <span className="text-xs text-neutral-400 tabular-nums">
                          {Number(l.viewer_count).toLocaleString()} viewers
                        </span>
                        <Link href={`/live/${l.id}`} className="text-xs font-semibold text-brand-400 hover:text-brand-300">
                          Open →
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="min-w-0 rounded-xl border border-surface-3 bg-surface-1 p-4 sm:p-5">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/30">
                  <TrendingUp className="h-4 w-4 text-brand-400" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Top video</h2>
              </div>
              {!topVideo ? (
                <p className="text-sm text-neutral-500">Upload something to see analytics here.</p>
              ) : (
                <Link href={`/watch/${topVideo.id}`} className="group block">
                  <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2">
                    {topVideo.thumbnail_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={topVideo.thumbnail_url} alt={topVideo.title} className="h-full w-full object-cover transition-transform group-hover:scale-[1.03]" />
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold text-neutral-100 group-hover:text-white">
                    {topVideo.title}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {Number(topVideo.views).toLocaleString()} views
                  </p>
                </Link>
              )}
            </div>
          </div>

          {/* Videos grid */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-extrabold tracking-tight">Your videos</h2>
              <span className="text-xs text-neutral-500">{totals.videos} total</span>
            </div>
            <VideoGrid videos={videos} />
          </section>
        </>
      )}
    </div>
  )
}
