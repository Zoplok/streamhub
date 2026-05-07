import Link from 'next/link'
import { ImageIcon } from 'lucide-react'

interface Props {
  id: string
  title: string
  thumbnail_url: string | null
  duration?: number
  views?: number
  channel_name?: string
  created_at?: string
}

function fmtDuration(sec?: number) {
  if (!sec) return ''
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = (sec % 60).toString().padStart(2, '0')
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s}`
  return `${m}:${s}`
}

function fmtViews(n?: number) {
  if (!n) return '0 views'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`
  return `${n} views`
}

function fmtRelative(iso?: string) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60); if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`
  const mo = Math.floor(d / 30); if (mo < 12) return `${mo}mo ago`
  return `${Math.floor(mo / 12)}y ago`
}

export function VideoCard(props: Props) {
  const initial = props.channel_name?.[0]?.toUpperCase() ?? '?'
  return (
    <Link href={`/watch/${props.id}`} className="group block">
      <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2 ring-1 ring-surface-3">
        {props.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={props.thumbnail_url}
            alt={props.title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface-2 to-surface-3 text-xs text-neutral-500">
            <ImageIcon className="h-7 w-7 opacity-70" />
            <span>No thumbnail</span>
          </div>
        )}
        {/* subtle gradient overlay */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {props.duration ? (
          <span className="absolute bottom-2 right-2 rounded-md bg-black/85 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-white ring-1 ring-white/5">
            {fmtDuration(props.duration)}
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex gap-2.5 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-surface-0">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-neutral-50 group-hover:text-brand-400">
            {props.title}
          </h3>
          {props.channel_name && (
            <p className="mt-1 truncate text-xs text-neutral-400 hover:text-neutral-200">
              {props.channel_name}
            </p>
          )}
          <p className="mt-0.5 text-xs text-neutral-500">
            {fmtViews(props.views)}
            {props.created_at && <span className="mx-1">·</span>}
            {fmtRelative(props.created_at)}
          </p>
        </div>
      </div>
    </Link>
  )
}
