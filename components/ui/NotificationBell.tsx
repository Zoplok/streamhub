'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell, CheckCheck, Circle, Heart, MessageCircle, Radio, UserPlus, Video, Loader2 } from 'lucide-react'

interface NotifItem {
  id: string
  type: string
  title: string
  body: string | null
  link: string | null
  thumbnail: string | null
  read_at: string | null
  created_at: string
  actor_id: string | null
  actor_username: string | null
  actor_avatar: string | null
}

function iconFor(type: string) {
  switch (type) {
    case 'new_video':     return Video
    case 'new_live':      return Radio
    case 'new_comment':
    case 'comment_reply': return MessageCircle
    case 'new_like':      return Heart
    case 'new_subscriber':return UserPlus
    default:              return Circle
  }
}

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime()
  if (Number.isNaN(d)) return ''
  const s = Math.floor((Date.now() - d) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const days = Math.floor(h / 24)
  if (days < 7) return `${days}d`
  const w = Math.floor(days / 7)
  return `${w}w`
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotifItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loading, setLoading] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/notifications?limit=30', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      setItems(j.data?.items ?? [])
      setUnread(Number(j.data?.unread ?? 0))
    } finally {
      setLoading(false)
    }
  }, [])

  // Poll the unread count every 30s; only fetch full list when opened.
  useEffect(() => {
    let alive = true
    async function poll() {
      try {
        const r = await fetch('/api/notifications?limit=1', { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (alive) setUnread(Number(j.data?.unread ?? 0))
      } catch { /* ignore */ }
    }
    void poll()
    const iv = setInterval(poll, 30_000)
    return () => { alive = false; clearInterval(iv) }
  }, [])

  // Load on open
  useEffect(() => {
    if (open) void load()
  }, [open, load])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const markAllRead = useCallback(async () => {
    setUnread(0)
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })))
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).catch(() => {})
  }, [])

  const markOneRead = useCallback(async (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: n.read_at ?? new Date().toISOString() } : n)))
    setUnread((n) => Math.max(0, n - 1))
    await fetch('/api/notifications/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    }).catch(() => {})
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-surface-2 hover:text-white"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-surface-0">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-12 z-50 w-[380px] max-w-[90vw] overflow-hidden rounded-xl border border-surface-3 bg-surface-1 shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
            <div>
              <p className="text-sm font-bold">Notifications</p>
              <p className="text-[11px] text-neutral-500">
                {unread > 0 ? `${unread} unread` : 'All caught up'}
              </p>
            </div>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-brand-400 hover:bg-surface-2 hover:text-brand-300"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[480px] overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-neutral-500">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Bell className="h-8 w-8 text-neutral-600" />
                <p className="text-sm text-neutral-400">No notifications yet</p>
                <p className="text-[11px] text-neutral-600">
                  Subscribe to channels to get updates when they go live.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-surface-3">
                {items.map((n) => {
                  const Icon = iconFor(n.type)
                  const unread = !n.read_at
                  const inner = (
                    <div
                      className={`flex gap-3 px-4 py-3 transition-colors ${
                        unread ? 'bg-brand-500/5 hover:bg-brand-500/10' : 'hover:bg-surface-2'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {n.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={n.thumbnail}
                            alt=""
                            className="h-12 w-12 rounded-lg object-cover ring-1 ring-surface-3"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-2 ring-1 ring-surface-3">
                            <Icon className="h-5 w-5 text-brand-400" />
                          </div>
                        )}
                        <span className="absolute -right-1 -bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-surface-1 ring-1 ring-surface-3">
                          <Icon className="h-3 w-3 text-brand-400" />
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-neutral-100">{n.title}</p>
                        {n.body && (
                          <p className="line-clamp-2 text-xs text-neutral-400">{n.body}</p>
                        )}
                        <p className="mt-0.5 text-[10px] uppercase tracking-wider text-neutral-500">
                          {timeAgo(n.created_at)} ago
                        </p>
                      </div>

                      {unread && (
                        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                      )}
                    </div>
                  )
                  const onClick = () => { if (unread) void markOneRead(n.id); setOpen(false) }
                  return (
                    <li key={n.id}>
                      {n.link ? (
                        <Link href={n.link} onClick={onClick} className="block">
                          {inner}
                        </Link>
                      ) : (
                        <button type="button" onClick={onClick} className="block w-full text-left">
                          {inner}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
