import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { VideoGrid } from '@/components/video/VideoGrid'
import { LiveCard } from '@/components/live/LiveCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Gamepad2, Music2, Clapperboard, Trophy, Newspaper, Tv, Utensils, Cpu, Tag } from 'lucide-react'

export const revalidate = 60

const CATEGORIES: Record<string, { label: string; icon: typeof Tag; accent: 'brand' | 'red' | 'amber' | 'blue' | 'violet'; description: string }> = {
  gaming:   { label: 'Gaming',   icon: Gamepad2,     accent: 'violet', description: 'Gameplay, guides, esports & more.' },
  music:    { label: 'Music',    icon: Music2,       accent: 'brand',  description: 'Tracks, covers, live sessions.' },
  film:     { label: 'Film',     icon: Clapperboard, accent: 'red',    description: 'Short films, trailers, breakdowns.' },
  sports:   { label: 'Sports',   icon: Trophy,       accent: 'amber',  description: 'Highlights, analysis, workouts.' },
  news:     { label: 'News',     icon: Newspaper,    accent: 'blue',   description: 'Daily briefs and deep dives.' },
  irl:      { label: 'IRL',      icon: Tv,           accent: 'violet', description: 'Real-life streams and vlogs.' },
  cooking:  { label: 'Cooking',  icon: Utensils,     accent: 'amber',  description: 'Recipes, techniques, reviews.' },
  tech:     { label: 'Tech',     icon: Cpu,          accent: 'blue',   description: 'Reviews, dev logs, tutorials.' }
}

export default async function CategoryPage({ params }: { params: { category: string } }) {
  const key = params.category.toLowerCase()
  const meta = CATEGORIES[key]
  if (!meta) notFound()

  const [vids, live] = await Promise.all([
    db.query<{
      id: string; title: string; thumbnail_url: string | null; duration: number;
      views: number; channel_name: string; created_at: string
    }>(
      `SELECT v.id, v.title, v.thumbnail_url, v.duration, v.views, v.created_at,
              c.name AS channel_name
       FROM videos v JOIN channels c ON c.id = v.channel_id
       WHERE v.status='ready' AND (v.category = ? OR JSON_CONTAINS(v.tags, JSON_QUOTE(?)))
       ORDER BY v.views DESC
       LIMIT 48`,
      [meta.label, key]
    ),
    db.query<{
      id: string; title: string; channel_name: string; viewer_count: number;
      thumbnail_url: string | null; category: string | null
    }>(
      `SELECT ls.id, ls.title, ls.viewer_count, ls.thumbnail_url, ls.category, c.name AS channel_name
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.status='live' AND (ls.category = ? OR c.category = ?)
       ORDER BY ls.viewer_count DESC
       LIMIT 6`,
      [meta.label, meta.label]
    )
  ])

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        icon={meta.icon}
        eyebrow="Category"
        title={meta.label}
        subtitle={meta.description}
        accent={meta.accent}
      />

      {live.rows.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-neutral-300">Live in {meta.label}</h2>
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

      <section>
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-neutral-300">Popular in {meta.label}</h2>
        <VideoGrid videos={vids.rows} />
      </section>
    </div>
  )
}
