'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { Comment, Short } from '@/types'
import { Heart, MessageCircle, Share2, Volume2, VolumeX, Play, Pause, X, Send, Check } from 'lucide-react'

interface ShortWithMeta extends Short {
  channel_name?: string
  comments_count?: number
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
  const [activeComments, setActiveComments] = useState<ShortWithMeta | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentError, setCommentError] = useState<string | null>(null)
  const [commentDelta, setCommentDelta] = useState<Record<string, number>>({})
  const [shareStatus, setShareStatus] = useState<Record<string, string>>({})
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

  async function openComments(short: ShortWithMeta) {
    setActiveComments(short)
    setComments([])
    setCommentText('')
    setCommentError(null)
    setCommentsLoading(true)
    try {
      const res = await fetch(`/api/shorts/${short.id}/comments`)
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to load comments')
      setComments(json.data ?? [])
    } catch (err) {
      setCommentError((err as Error).message)
    } finally {
      setCommentsLoading(false)
    }
  }

  async function submitComment() {
    if (!activeComments || !commentText.trim()) return
    setCommentError(null)
    try {
      const res = await fetch(`/api/shorts/${activeComments.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: commentText.trim() })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Failed to post comment')
      setComments((prev) => [...prev, { ...json.data, replies: [] }])
      setCommentDelta((prev) => ({
        ...prev,
        [activeComments.id]: (prev[activeComments.id] ?? 0) + 1
      }))
      setCommentText('')
    } catch (err) {
      setCommentError((err as Error).message)
    }
  }

  async function shareShort(short: ShortWithMeta) {
    const url = `${window.location.origin}/shorts#${short.id}`
    try {
      if (navigator.share) {
        await navigator.share({ title: short.title, text: short.description ?? undefined, url })
        setShareStatus((s) => ({ ...s, [short.id]: 'Shared' }))
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        setShareStatus((s) => ({ ...s, [short.id]: 'Copied' }))
      } else {
        setShareStatus((s) => ({ ...s, [short.id]: url }))
      }
      window.setTimeout(() => {
        setShareStatus((s) => {
          const next = { ...s }
          delete next[short.id]
          return next
        })
      }, 1800)
    } catch {
      setShareStatus((s) => ({ ...s, [short.id]: 'Share canceled' }))
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
        const commentsCount = Number(s.comments_count ?? 0) + Number(commentDelta[s.id] ?? 0)
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
                  {s.description && (
                    <p className="mt-2 line-clamp-3 max-w-xl whitespace-pre-line text-xs leading-relaxed text-neutral-200">
                      {s.description}
                    </p>
                  )}
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

              <button
                className="group flex flex-col items-center"
                aria-label="Comment"
                onClick={() => openComments(s)}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                  <MessageCircle className="h-6 w-6" />
                </div>
                <span className="mt-1 text-[11px] font-semibold text-white drop-shadow">
                  {fmtCount(commentsCount)}
                </span>
              </button>

              <button
                className="group flex flex-col items-center"
                aria-label="Share"
                onClick={() => shareShort(s)}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70">
                  {shareStatus[s.id] === 'Copied' || shareStatus[s.id] === 'Shared'
                    ? <Check className="h-6 w-6" />
                    : <Share2 className="h-6 w-6" />}
                </div>
                <span className="mt-1 max-w-[4.5rem] truncate text-[11px] font-semibold text-white drop-shadow">
                  {shareStatus[s.id] ?? 'Share'}
                </span>
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
      {activeComments && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 backdrop-blur-sm sm:items-center sm:p-4">
          <div className="flex max-h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-surface-3 bg-surface-1 shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-neutral-100">Comments</p>
                <p className="truncate text-xs text-neutral-500">{activeComments.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveComments(null)}
                className="rounded-full p-2 text-neutral-400 hover:bg-surface-3 hover:text-white"
                aria-label="Close comments"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
              {commentsLoading ? (
                <p className="py-8 text-center text-sm text-neutral-500">Loading comments...</p>
              ) : comments.length > 0 ? (
                <div className="space-y-4">
                  {comments.map((comment) => (
                    <ShortComment key={comment.id} comment={comment} />
                  ))}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-neutral-500">No comments yet.</p>
              )}
            </div>

            {commentError && (
              <div className="mx-4 mb-2 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-300">
                {commentError}
              </div>
            )}

            <div className="border-t border-surface-3 p-3">
              <div className="flex items-end gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  maxLength={2000}
                  className="min-h-[44px] flex-1 resize-none rounded-xl border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-neutral-100 placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                />
                <button
                  type="button"
                  onClick={submitComment}
                  disabled={!commentText.trim()}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-surface-0 transition-colors hover:bg-brand-400 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Post comment"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ShortComment({ comment }: { comment: Comment }) {
  const initial = comment.username?.[0]?.toUpperCase() ?? '?'
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs font-bold text-neutral-200">
        {initial}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-neutral-100">
          {comment.username ?? 'User'}
          <span className="ml-2 font-normal text-neutral-500">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </p>
        <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-300">
          {comment.content}
        </p>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 space-y-3 border-l border-surface-3 pl-3">
            {comment.replies.map((reply) => (
              <ShortComment key={reply.id} comment={reply} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
