import Link from 'next/link'
import { headers } from 'next/headers'
import { VideoGrid } from '@/components/video/VideoGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { Search, Sparkles } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface VideoRow {
  id: string
  title: string
  thumbnail_url: string | null
  duration: number
  views: number
  channel_name: string
  created_at: string
}

interface ChannelRow {
  id: string
  name: string
  avatar_url: string | null
  description: string | null
  subscribers: number
}

async function aiSearch(q: string): Promise<{
  videos: VideoRow[]
  channels: ChannelRow[]
  expansions: string[]
  categories: string[]
}> {
  try {
    const h = headers()
    const host = h.get('host') ?? 'localhost:3002'
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const res = await fetch(`${proto}://${host}/api/ai/semantic-search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
      cache: 'no-store'
    })
    if (!res.ok) throw new Error('search failed')
    const json = await res.json()
    return {
      videos: json.data?.videos ?? [],
      channels: json.data?.channels ?? [],
      expansions: json.data?.expansions ?? [],
      categories: json.data?.categories ?? []
    }
  } catch {
    return { videos: [], channels: [], expansions: [], categories: [] }
  }
}

export default async function SearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const q = (searchParams.q ?? '').trim()

  let videos: VideoRow[] = []
  let channels: ChannelRow[] = []
  let expansions: string[] = []
  let categories: string[] = []

  if (q) {
    const r = await aiSearch(q)
    videos = r.videos
    channels = r.channels
    expansions = r.expansions
    categories = r.categories
  }

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        icon={Search}
        eyebrow="AI search"
        title={q ? `Results for "${q}"` : 'Search StreamHub'}
        subtitle={q ? `${videos.length} videos · ${channels.length} channels` : 'Enter a query in the search bar above.'}
        accent="brand"
      />

      {q && (expansions.length > 0 || categories.length > 0) && (
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-xl border border-brand-500/20 bg-gradient-to-r from-brand-500/5 to-transparent px-4 py-3">
          <Sparkles className="h-4 w-4 shrink-0 text-brand-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Also searched</span>
          {expansions.slice(0, 6).map((e) => (
            <Link
              key={e}
              href={`/search?q=${encodeURIComponent(e)}`}
              className="chip !h-7 !text-xs"
            >
              {e}
            </Link>
          ))}
          {categories.map((c) => (
            <Link
              key={c}
              href={`/c/${c}`}
              className="inline-flex h-7 items-center rounded-lg bg-brand-500/15 px-3 text-xs font-semibold text-brand-300 ring-1 ring-brand-500/30 hover:bg-brand-500/25"
            >
              {c}
            </Link>
          ))}
        </div>
      )}

      {!q && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-3 bg-surface-1 py-20 text-center">
          <div className="mb-3 text-4xl">🔎</div>
          <p className="text-sm font-medium text-neutral-300">Try searching for something</p>
          <p className="mt-1 text-xs text-neutral-500">Videos, creators, or topics.</p>
        </div>
      )}

      {q && channels.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-neutral-300">Channels</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {channels.map((c) => {
              const initial = c.name[0]?.toUpperCase() ?? '?'
              return (
                <Link
                  key={c.id}
                  href={`/channel/${c.id}`}
                  className="group flex items-center gap-4 rounded-xl border border-surface-3 bg-surface-1 p-4 transition-colors hover:border-brand-500/40 hover:bg-surface-2"
                >
                  <div
                    className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-extrabold text-surface-0 ring-2 ring-surface-3"
                    style={
                      c.avatar_url
                        ? { backgroundImage: `url(${c.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                        : undefined
                    }
                  >
                    {!c.avatar_url && initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-100 group-hover:text-white">{c.name}</p>
                    <p className="text-xs text-neutral-500">{Number(c.subscribers).toLocaleString()} subscribers</p>
                    {c.description && (
                      <p className="mt-1 line-clamp-1 text-xs text-neutral-400">{c.description}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {q && (
        <section>
          <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-neutral-300">Videos</h2>
          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-3 bg-surface-1 py-20 text-center">
              <p className="text-sm font-medium text-neutral-300">No results</p>
              <p className="mt-1 text-xs text-neutral-500">Try a different query.</p>
            </div>
          ) : (
            <VideoGrid videos={videos} />
          )}
        </section>
      )}
    </div>
  )
}
