'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Short } from '@/types'
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, Pause } from 'lucide-react'

interface ShortWithMeta extends Short {
  channel_name?: string
}

interface Props {
  initial: ShortWithMeta[]
  loadMore: (cursor: string | null) => Promise<{ data: ShortWithMeta[]; nextCursor: string | null }>
  initialCursor: string | null
}

function fmtCount(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function ShortsPlayer({ initial, loadMore, initialCursor }: Props) {
  const [items, setItems] = useState<ShortWithMeta[]>(initial)
  const [cursor, setCursor] = useState<string | null>(initialCursor)
  const [loading, setLoading] = useState(false)
  const [muted, setMuted] = useState(true)
  const [playing, setPlaying] = useState<Record<string, boolean>>({})
  const [liked, setLiked] = useState<Record<string, boolean>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    const videos = root.querySelectorAll<HTMLVideoElement>('video[data-short]')
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement
          const id = v.dataset.id ?? ''
          if (e.intersectionRatio > 0.7) {
            v.play().catch(() => {})
            setPlaying((p) => ({ ...p, [id]: true }))
          } else {
            v.pause()
            setPlaying((p) => ({ ...p, [id]: false }))
          }
        }
      },
      { threshold: [0, 0.7, 1] }
    )
    videos.forEach((v) => io.observe(v))

    const last = root.querySelector<HTMLDivElement>('[data-sentinel]')
    let sentinelIO: IntersectionObserver | null = null
    if (last && cursor) {
      sentinelIO = new IntersectionObserver(
        async (entries) => {
          if (entries[0].isIntersecting && !loading && cursor) {
            setLoading(true)
            const res = await loadMore(cursor)
            setItems((prev) => [...prev, ...res.data])
            setCursor(res.nextCursor)
            setLoading(false)
          }
        },
        { threshold: 0.1 }
      )
      sentinelIO.observe(last)
    }
    return () => {
      io.disconnect()
      sentinelIO?.disconnect()
    }
  }, [items, cursor, loading, loadMore])

  function toggleMute() {
    setMuted((m) => {
      const next = !m
      const vids = containerRef.current?.querySelectorAll<HTMLVideoElement>('video[data-short]')
      vids?.forEach((v) => (v.muted = next))
      return next
    })
  }

  function togglePlay(el: HTMLVideoElement, id: string) {
    if (el.paused) {
      el.play().catch(() => {})
      setPlaying((p) => ({ ...p, [id]: true }))
    } else {
      el.pause()
      setPlaying((p) => ({ ...p, [id]: false }))
    }
  }

  async function toggleLike(shortId: string) {
    const next = !liked[shortId]
    setLiked((l) => ({ ...l, [shortId]: next }))
    try {
      await fetch('/api/reactions', {
        method: next ? 'POST' : 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: 'short', target_id: shortId, type: 'like' })
      })
    } catch {
      setLiked((l) => ({ ...l, [shortId]: !next }))
    }
  }

  return (
    <div
      ref={containerRef}
      className="h-[calc(100vh-3.5rem)] snap-y snap-mandatory overflow-y-scroll bg-black"
    >
      {items.map((s) => {
        const initial = s.channel_name?.[0]?.toUpperCase() ?? '?'
        const isPlaying = playing[s.id] ?? true
        const isLiked = liked[s.id] ?? false
        return (
          <div
            key={s.id}
            className="relative flex h-[calc(100vh-3.5rem)] snap-start items-center justify-center overflow-hidden bg-black"
          >
            {/* Blurred backdrop */}
            {s.thumbnail_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={s.thumbnail_url}
                alt=""
                aria-hidden="true"
                className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
              />
            )}

            {/* Video */}
            <div className="relative z-10 flex h-full max-h-full items-center justify-center">
              <video
                data-short
                data-id={s.id}
                src={s.video_url}
                poster={s.thumbnail_url ?? undefined}
                loop
                playsInline
                muted={muted}
                onClick={(e) => togglePlay(e.currentTarget, s.id)}
                className="h-full max-h-full w-auto cursor-pointer rounded-lg"
              />
              {!isPlaying && (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black/50 ring-2 ring-white/30 backdrop-blur-sm">
                    <Play className="h-8 w-8 translate-x-0.5 fill-white text-white" />
                  </div>
                </div>
              )}
            </div>

            {/* Bottom info gradient */}
            <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-4 pb-6">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1 text-white">
                  {s.channel_name && (
                    <Link
                      href={s.channel_id ? `/channel/${s.channel_id}` : '#'}
                      className="inline-flex items-center gap-2 group"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-extrabold text-surface-0 ring-2 ring-white/20">
                        {initial}
                      </div>
                      <span className="font-semibold tracking-tight group-hover:text-brand-300">
                        @{s.channel_name}
                      </span>
                    </Link>
                  )}
                  <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">{s.title}</p>
                  <p className="mt-1 text-[11px] text-neutral-400">{s.views.toLocaleString()} views</p>
                </div>
              </div>
            </div>

            {/* Side action rail */}
            <div className="absolute right-3 bottom-24 z-30 flex flex-col items-center gap-5">
              <button
                onClick={() => toggleLike(s.id)}
                className="group flex flex-col items-center"
                aria-label="Like"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full transition-all ${
                    isLiked ? 'bg-red-500 text-white scale-110' : 'bg-black/50 text-white hover:bg-black/70'
                  }`}
                >
                  <Heart className={`h-6 w-6 ${isLiked ? 'fill-current' : ''}`} />
                </div>
                <span className="mt-1 text-[11px] font-semibold text-white drop-shadow">
                  {fmtCount(Math.floor(s.views * 0.08) + (isLiked ? 1 : 0))}
                </span>
              </button>

              <button className="group flex flex-col items-center" aria-label="Comment">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <span className="mt-1 text-[11px] font-semibold text-white drop-shadow">
                  {fmtCount(Math.floor(s.views * 0.015))}
                </span>
              </button>

              <button
                className="group flex flex-col items-center"
                aria-label="Share"
                onClick={() => {
                  if (typeof navigator !== 'undefined' && 'share' in navigator) {
                    navigator.share?.({ title: s.title, url: `${window.location.origin}/shorts` }).catch(() => {})
                  }
                }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                  <Share2 className="h-6 w-6" />
                </div>
                <span className="mt-1 text-[11px] font-semibold text-white drop-shadow">Share</span>
              </button>

              <button onClick={toggleMute} className="group flex flex-col items-center" aria-label="Mute toggle">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                  {muted ? <VolumeX className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
                </div>
              </button>
            </div>

            {/* Play/Pause corner hint */}
            <button
              onClick={(e) => {
                const v = e.currentTarget.parentElement?.querySelector<HTMLVideoElement>('video[data-short]')
                if (v) togglePlay(v, s.id)
              }}
              className="absolute top-4 right-4 z-20 hidden h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70 sm:flex"
              aria-label="Play/Pause"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </button>
          </div>
        )
      })}
      {cursor && <div data-sentinel className="h-8" />}
    </div>
  )
}
