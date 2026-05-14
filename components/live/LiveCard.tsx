import Link from 'next/link'
import { Eye, Radio } from 'lucide-react'

interface Props {
  id: string
  title: string
  channel_name: string
  viewer_count: number
  thumbnail_url?: string | null
  category?: string | null
}

function fmtViewers(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function LiveCard(p: Props) {
  const initial = p.channel_name?.[0]?.toUpperCase() ?? '?'
  return (
    <Link
      href={`/live/${p.id}`}
      className="group block overflow-hidden rounded-lg bg-surface-1 ring-1 ring-surface-3 transition-all hover:ring-brand-500/60 hover:shadow-glow"
    >
      <div className="relative aspect-video overflow-hidden bg-surface-2">
        {p.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.thumbnail_url}
            alt={p.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="relative flex h-full w-full flex-col items-center justify-center gap-3 bg-gradient-to-br from-red-600/30 via-red-900/20 to-surface-3">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(239,68,68,0.25),transparent_60%)]" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-red-600/90 text-white shadow-lg shadow-red-600/40 ring-4 ring-red-600/20">
              <Radio className="h-7 w-7 animate-pulse" />
            </div>
            <span className="relative text-2xl font-black uppercase tracking-widest text-white drop-shadow">
              {initial}
            </span>
            <span className="relative text-xs font-semibold uppercase tracking-wider text-neutral-200">
              {p.channel_name}
            </span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

        {/* Pulsing LIVE badge */}
        <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-white animate-live-pulse">
          <span className="h-1.5 w-1.5 rounded-full bg-white" />
          Live
        </div>

        {/* Viewer count */}
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm">
          <Eye className="h-3 w-3" />
          {fmtViewers(p.viewer_count)}
        </div>

        {/* Category pill */}
        {p.category && (
          <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-0.5 text-xs font-semibold text-neutral-100 backdrop-blur-sm">
            {p.category}
          </div>
        )}
      </div>
      <div className="flex gap-3 p-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700 text-sm font-bold text-white ring-2 ring-red-500/40">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-50 group-hover:text-brand-400">
            {p.title}
          </h3>
          <p className="mt-0.5 truncate text-xs text-neutral-400">{p.channel_name}</p>
        </div>
      </div>
    </Link>
  )
}
