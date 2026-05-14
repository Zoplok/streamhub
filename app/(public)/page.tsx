import { cachedDbQuery } from '@/lib/cached-db'
import { VideoGrid } from '@/components/video/VideoGrid'
import { LiveCard } from '@/components/live/LiveCard'
import { Radio, TrendingUp, Film } from 'lucide-react'
import Link from 'next/link'

export const revalidate = 30

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
  hls_url: string | null
  thumbnail_url: string | null
  category: string | null
}

interface ShortRow {
  id: string
  title: string
  thumbnail_url: string | null
  views: number
  channel_name: string
}

// Each chip links to either `/` (All), `/live`, or a category page `/c/<slug>`.
const CHIPS: { label: string; href: string }[] = [
  { label: 'All',      href: '/' },
  { label: 'Live',     href: '/live' },
  { label: 'Gaming',   href: '/c/gaming' },
  { label: 'Music',    href: '/c/music' },
  { label: 'Sports',   href: '/c/sports' },
  { label: 'News',     href: '/c/news' },
  { label: 'Film',     href: '/c/film' },
  { label: 'IRL',      href: '/c/irl' },
  { label: 'Tech',     href: '/c/tech' },
  { label: 'Cooking',  href: '/c/cooking' },
  { label: 'Trending', href: '/trending' },
  { label: 'Shorts',   href: '/shorts' }
]

export default async function HomePage() {
  const [videos, live, shorts] = await Promise.all([
    cachedDbQuery<VideoRow>(
      'home:videos',
      `SELECT v.id, v.title, v.thumbnail_url, v.duration, v.views, v.created_at, c.name AS channel_name
       FROM videos v JOIN channels c ON c.id = v.channel_id
       WHERE v.status='ready'
       ORDER BY v.created_at DESC
       LIMIT 24`,
      [],
      30
    ),
    cachedDbQuery<LiveRow>(
      'home:live:v2',
      `SELECT ls.id, ls.title, ls.viewer_count, ls.hls_url, ls.thumbnail_url, ls.category, c.name AS channel_name
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.status='live'
       ORDER BY ls.viewer_count DESC
       LIMIT 6`,
      [],
      15
    ),
    cachedDbQuery<ShortRow>(
      'home:shorts',
      `SELECT s.id, s.title, s.thumbnail_url, s.views, c.name AS channel_name
       FROM shorts s JOIN channels c ON c.id = s.channel_id
       ORDER BY s.created_at DESC
       LIMIT 8`,
      [],
      30
    )
  ])

  const totalViewers = live.rows.reduce((sum, s) => sum + Number(s.viewer_count || 0), 0)

  return (
    <div className="px-3 py-4 sm:px-4 sm:py-5 md:px-6 lg:px-8">
      {/* Category chips (YouTube-style scroller) */}
      <div className="mb-5 -mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <div className="flex gap-2 pb-1">
          {CHIPS.map((c, i) => (
            <Link key={c.href} href={c.href} className={`chip shrink-0 ${i === 0 ? 'chip-active' : ''}`}>
              {c.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Live hero */}
      {live.rows.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-600 text-white shadow-lg shadow-red-600/20">
                <Radio className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Live now</h2>
                <p className="text-xs text-neutral-400">
                  {live.rows.length} stream{live.rows.length === 1 ? '' : 's'} · {totalViewers.toLocaleString()} watching
                </p>
              </div>
            </div>
            <Link href="/live" className="text-sm font-medium text-brand-400 hover:text-brand-300">
              See all →
            </Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-5">
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

      {/* Shorts strip */}
      {shorts.rows.length > 0 && (
        <section className="mb-10">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500 text-white shadow-lg shadow-pink-500/20">
                <Film className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold tracking-tight">Shorts</h2>
                <p className="text-xs text-neutral-400">Quick clips from creators</p>
              </div>
            </div>
            <Link href="/shorts" className="text-sm font-medium text-brand-400 hover:text-brand-300">
              See all →
            </Link>
          </div>
          <div className="-mx-4 overflow-x-auto px-4 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
            <div className="flex gap-4 pb-2">
              {shorts.rows.map((s) => (
                <Link
                  key={s.id}
                  href={`/shorts#${s.id}`}
                  className="group relative aspect-[9/16] w-[136px] shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-surface-3 transition-transform hover:-translate-y-0.5 sm:w-[160px]"
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
                    <p className="text-[10px] text-neutral-300">{s.channel_name} · {Number(s.views).toLocaleString()} views</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-surface-0 shadow-glow">
            <TrendingUp className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-extrabold tracking-tight">Latest videos</h2>
        </div>
        <VideoGrid videos={videos.rows} />
      </section>
    </div>
  )
}
