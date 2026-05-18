'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/Button'
import { Bot, Send, Shield, Sparkles, Users, Smile, ImageIcon, X, Search, ChevronDown, DollarSign } from 'lucide-react'
import { SUPERCHAT_MAX_USD, SUPERCHAT_MIN_USD, formatMoneyFromCents, parseSuperchatContent } from '@/lib/superchat'

const EmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false })

interface ChatMsg {
  id: string
  stream_id: string
  user_id: string
  username: string
  content: string
  created_at: string
  flagged?: string
  bot?: boolean
}

interface GifResult {
  id: string
  title: string
  preview: string
  url: string
}

const TENOR_KEY = process.env.NEXT_PUBLIC_TENOR_API_KEY ?? 'LIVDSRZULELA'

const USERNAME_COLORS = [
  '#FF4500', '#FF69B4', '#1E90FF', '#00FF7F', '#FFD700',
  '#FF6347', '#BA55D3', '#00CED1', '#FF8C00', '#7FFF00',
  '#DC143C', '#4169E1', '#32CD32', '#FF1493', '#00BFFF',
  '#FF7F50', '#9400D3', '#20B2AA', '#FF4081', '#76FF03'
]

function getUserColor(name: string): string {
  let h = 0
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h)
  return USERNAME_COLORS[Math.abs(h) % USERNAME_COLORS.length]
}

export function ChatSidebar({
  streamId,
  userId,
  username,
  channelOwnerId,
  superchatStatus,
  superchatSessionId,
  superchatId
}: {
  streamId: string
  userId: string | null
  username: string | null
  channelOwnerId?: string
  superchatStatus?: string | null
  superchatSessionId?: string | null
  superchatId?: string | null
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [viewers, setViewers] = useState(0)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  const [usingPolling, setUsingPolling] = useState(false)
  const [realtimeUnavailable, setRealtimeUnavailable] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
  const [showSuperchat, setShowSuperchat] = useState(false)
  const [superchatAmount, setSuperchatAmount] = useState('5')
  const [superchatMessage, setSuperchatMessage] = useState('')
  const [superchatLoading, setSuperchatLoading] = useState(false)
  const [superchatError, setSuperchatError] = useState<string | null>(null)
  const [superchatNotice, setSuperchatNotice] = useState<string | null>(null)
  const [gifQuery, setGifQuery] = useState('')
  const [gifs, setGifs] = useState<GifResult[]>([])
  const [gifLoading, setGifLoading] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const emojiRef = useRef<HTMLDivElement | null>(null)
  const gifRef = useRef<HTMLDivElement | null>(null)
  const seenMessagesRef = useRef<Set<string>>(new Set())
  const lastMessageAtRef = useRef<string | null>(null)
  const socketOwnsViewers = useRef(false)
  const isAtBottomRef = useRef(true)
  const canSendSuperchat = !!userId && !!username && !!channelOwnerId && userId !== channelOwnerId

  const mergeMessages = useCallback((nextMessages: ChatMsg[]) => {
    if (nextMessages.length === 0) return
    setMessages((prev) => {
      const merged = [...prev]
      for (const message of nextMessages) {
        if (seenMessagesRef.current.has(message.id)) continue
        seenMessagesRef.current.add(message.id)
        merged.push(message)
        if (
          !lastMessageAtRef.current ||
          new Date(message.created_at).getTime() > new Date(lastMessageAtRef.current).getTime()
        ) {
          lastMessageAtRef.current = message.created_at
        }
        if (message.bot) setBotThinking(false)
      }
      return merged.slice(-200)
    })
  }, [])

  // Always poll viewer count from REST API as a reliable fallback
  useEffect(() => {
    async function fetchViewers() {
      try {
        const res = await fetch(`/api/streams/${streamId}`, { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json() as { data?: { viewer_count?: number } }
        if (!socketOwnsViewers.current && typeof json.data?.viewer_count === 'number') {
          setViewers(json.data.viewer_count)
        }
      } catch { /* ignore */ }
    }
    fetchViewers()
    const timer = window.setInterval(fetchViewers, 10_000)
    return () => window.clearInterval(timer)
  }, [streamId])

  useEffect(() => {
    if (superchatStatus === 'cancel') {
      setSuperchatNotice('Superchat payment was canceled.')
      return
    }
    if (superchatStatus !== 'success' || !superchatSessionId || !superchatId || !userId) return

    let cancelled = false
    async function confirmPayment() {
      setSuperchatNotice('Confirming card payment...')
      try {
        const res = await fetch(`/api/streams/${streamId}/superchat/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            superchat_id: superchatId,
            session_id: superchatSessionId
          })
        })
        const json = await res.json().catch(() => null) as { error?: string }
        if (cancelled) return
        if (!res.ok) {
          setSuperchatNotice(null)
          setSuperchatError(json?.error || 'Payment confirmation failed.')
          return
        }
        setSuperchatNotice('Superchat sent. Thanks for supporting the stream!')
      } catch {
        if (!cancelled) {
          setSuperchatNotice(null)
          setSuperchatError('Payment confirmation failed. Please try again.')
        }
      }
    }

    void confirmPayment()
    return () => {
      cancelled = true
    }
  }, [streamId, superchatId, superchatSessionId, superchatStatus, userId])

  // Close emoji / gif panels on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(e.target as Node)) setShowEmoji(false)
      if (gifRef.current && !gifRef.current.contains(e.target as Node)) setShowGif(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const searchGifs = useCallback(async (q: string) => {
    if (!q.trim()) return
    setGifLoading(true)
    try {
      const res = await fetch(
        `https://api.tenor.com/v1/search?q=${encodeURIComponent(q)}&key=${TENOR_KEY}&limit=16&media_filter=minimal`
      )
      const json = await res.json() as {
        results?: Array<{
          id: string
          title: string
          media: Array<{ tinygif?: { url: string }; gif?: { url: string } }>
        }>
      }
      setGifs((json.results ?? []).map(r => ({
        id: r.id,
        title: r.title,
        preview: r.media[0]?.tinygif?.url ?? '',
        url: r.media[0]?.gif?.url ?? r.media[0]?.tinygif?.url ?? ''
      })))
    } catch {
      setGifs([])
    } finally {
      setGifLoading(false)
    }
  }, [])

  const sendGif = useCallback((gifUrl: string) => {
    const content = `[gif:${gifUrl}]`
    if (usingPolling) {
      fetch(`/api/streams/${streamId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      })
        .then(r => r.json())
        .then((json: { data?: ChatMsg[] }) => mergeMessages(json.data ?? []))
        .catch(() => {})
    } else {
      socketRef.current?.emit('chat:send', { streamId, userId, username, content })
    }
    setShowGif(false)
    setGifQuery('')
    setGifs([])
  }, [usingPolling, streamId, userId, username, mergeMessages])

  useEffect(() => {
    const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL?.replace(/\/$/, '')
    const isVercel = window.location.hostname.endsWith('.vercel.app')

    if (isVercel && !realtimeUrl) {
      setUsingPolling(true)
      setRealtimeUnavailable(false)
      let cancelled = false

      async function loadMessages() {
        const after = lastMessageAtRef.current
        const query = new URLSearchParams()
        if (after) query.set('after', after)
        query.set('limit', after ? '100' : '50')

        try {
          const res = await fetch(`/api/streams/${streamId}/chat?${query.toString()}`, {
            cache: 'no-store'
          })
          if (!res.ok || cancelled) return
          const json = await res.json() as { data?: ChatMsg[] }
          mergeMessages(json.data ?? [])
        } catch {
          if (!cancelled) setRealtimeUnavailable(true)
        }
      }

      void loadMessages()
      const timer = window.setInterval(loadMessages, 2500)
      return () => {
        cancelled = true
        window.clearInterval(timer)
      }
    }

    setUsingPolling(false)
    const s = io(realtimeUrl || undefined, { path: '/api/socket' })
    socketRef.current = s
    setRealtimeUnavailable(false)
    s.emit('stream:join', streamId)
    s.on('connect_error', () => {
      setRealtimeUnavailable(true)
    })
    s.on('chat:message', (m: ChatMsg) => {
      mergeMessages([m])
    })
    s.on('stream:viewers', (n: number) => {
      socketOwnsViewers.current = true
      setViewers(n)
    })
    s.on('disconnect', () => {
      socketOwnsViewers.current = false
    })
    s.on('chat:blocked', (b: { reason: string }) => {
      setBlocked(b.reason)
      setTimeout(() => setBlocked(null), 4000)
    })
    return () => {
      s.emit('stream:leave', streamId)
      s.disconnect()
      socketRef.current = null
    }
  }, [mergeMessages, streamId])

  function handleScroll() {
    const el = listRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    isAtBottomRef.current = nearBottom
    setShowScrollBtn(!nearBottom)
  }

  function scrollToBottom() {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    isAtBottomRef.current = true
    setShowScrollBtn(false)
  }

  useEffect(() => {
    if (isAtBottomRef.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  function insertEmoji(emojiData: { emoji: string }) {
    setText(prev => prev + emojiData.emoji)
    setShowEmoji(false)
  }

  async function startSuperchatCheckout() {
    if (!canSendSuperchat) return

    const amount = Number(superchatAmount)
    if (!Number.isFinite(amount) || amount < SUPERCHAT_MIN_USD || amount > SUPERCHAT_MAX_USD) {
      setSuperchatError(`Amount must be between $${SUPERCHAT_MIN_USD} and $${SUPERCHAT_MAX_USD}.`)
      return
    }
    if (!superchatMessage.trim()) {
      setSuperchatError('Add a message for your superchat.')
      return
    }

    setSuperchatLoading(true)
    setSuperchatError(null)
    try {
      const res = await fetch(`/api/streams/${streamId}/superchat/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount_usd: amount,
          currency: 'usd',
          message: superchatMessage.trim()
        })
      })
      const json = await res.json().catch(() => null) as { data?: { checkout_url?: string }; error?: string }
      if (!res.ok || !json?.data?.checkout_url) {
        setSuperchatError(json?.error || 'Could not start card checkout.')
        return
      }
      window.location.href = json.data.checkout_url
    } catch {
      setSuperchatError('Could not start card checkout.')
    } finally {
      setSuperchatLoading(false)
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = text.trim()
    if (!trimmed || !userId || !username) return

    if (/^@streambot\b/i.test(trimmed)) setBotThinking(true)

    if (usingPolling) {
      try {
        const res = await fetch(`/api/streams/${streamId}/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: trimmed })
        })
        const json = await res.json().catch(() => null) as { data?: ChatMsg[]; blocked?: { reason: string } } | null
        if (json?.blocked) {
          setBlocked(json.blocked.reason)
          setBotThinking(false)
          setTimeout(() => setBlocked(null), 4000)
          return
        }
        mergeMessages(json?.data ?? [])
        setText('')
      } catch {
        setRealtimeUnavailable(true)
        setBotThinking(false)
      }
      return
    }

    socketRef.current?.emit('chat:send', { streamId, userId, username, content: trimmed })
    setText('')
  }

  return (
    <aside className="flex h-[500px] flex-col overflow-hidden border-t border-surface-3 bg-surface-1 lg:h-full lg:border-l lg:border-t-0">
      <div className="flex items-center justify-between border-b border-surface-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-extrabold tracking-tight">Live chat</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-red-600/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 ring-1 ring-red-600/30">
            <span className="h-1 w-1 rounded-full bg-red-500 animate-pulse" />
            Live
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
          <Users className="h-3.5 w-3.5" />
          <span className="tabular-nums">{viewers.toLocaleString()}</span>
        </div>
      </div>

      <div className="flex items-start gap-2 border-b border-surface-3 bg-gradient-to-br from-brand-500/5 to-transparent px-4 py-2.5">
        <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-400" />
        <p className="text-[11px] leading-tight text-neutral-400">
          AI-moderated chat. Ask{' '}
          <span className="font-semibold text-brand-400">@StreamBot</span>{' '}
          anything about the stream.
        </p>
      </div>
      {usingPolling && (
        <div className="border-b border-surface-3 bg-surface-2/60 px-4 py-2 text-[11px] leading-tight text-neutral-300">
          Chat is connected with Vercel-compatible updates.
        </div>
      )}
      {realtimeUnavailable && (
        <div className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-2 text-[11px] leading-tight text-amber-200">
          Chat updates are having trouble connecting. Messages will retry shortly.
        </div>
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <ul
          ref={listRef}
          onScroll={handleScroll}
          className="absolute inset-0 overflow-y-auto px-2 py-2"
        >
          {messages.length === 0 && (
            <li className="mt-8 text-center text-xs text-neutral-500">Be the first to say hi</li>
          )}
          {messages.map((m) => {
            const gifMatch = m.content.match(/^\[gif:(https?:\/\/[^\]]+)\]$/)
            const superchat = parseSuperchatContent(m.content)
            return (
              <li
                key={m.id}
                className="rounded px-2 py-0.5 text-sm leading-relaxed hover:bg-white/5"
              >
                {m.bot ? (
                  <span className="break-words">
                    <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface-0 align-middle">
                      <Bot className="h-2.5 w-2.5" />
                      StreamBot
                    </span>
                    <span className="text-neutral-100">{m.content}</span>
                  </span>
                ) : gifMatch ? (
                  <span className="break-words">
                    <span className="mr-0.5 font-bold" style={{ color: getUserColor(m.username) }}>{m.username}</span>
                    <span className="text-neutral-500">: </span>
                    <img src={gifMatch[1]} alt="GIF" className="mt-1 block max-h-32 rounded-lg object-contain" loading="lazy" />
                  </span>
                ) : superchat ? (
                  <div className="rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent p-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-extrabold uppercase tracking-wider" style={{ color: getUserColor(m.username) }}>
                        {m.username}
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-bold text-amber-200">
                        {formatMoneyFromCents(superchat.amountCents, superchat.currency)}
                      </span>
                    </div>
                    <p className="mt-1 break-words text-sm text-neutral-100">{superchat.message}</p>
                  </div>
                ) : (
                  <span className="break-words">
                    <span className="mr-0.5 font-bold" style={{ color: getUserColor(m.username) }}>{m.username}</span>
                    {m.flagged && (
                      <span className="mx-1 inline-flex items-center rounded bg-amber-500/20 px-1 text-[9px] text-amber-300 align-middle" title={`Flagged: ${m.flagged}`}>
                        <Shield className="h-2 w-2" />
                      </span>
                    )}
                    <span className="text-neutral-500">: </span>
                    <span className="text-neutral-200">{m.content}</span>
                  </span>
                )}
              </li>
            )
          })}
          {botThinking && (
            <li className="rounded px-2 py-0.5 text-sm leading-relaxed hover:bg-white/5">
              <span className="mr-1 inline-flex items-center gap-0.5 rounded bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface-0 align-middle">
                <Bot className="h-2.5 w-2.5" />
                StreamBot
              </span>
              <span className="inline-flex gap-0.5 align-middle">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
              </span>
            </li>
          )}
        </ul>

        {showScrollBtn && (
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-brand-500 px-3 py-1 text-xs font-semibold text-black shadow-lg hover:bg-brand-400 transition-colors"
          >
            <ChevronDown className="h-3.5 w-3.5" />
            More messages
          </button>
        )}
      </div>

      {userId ? (
        <div className="shrink-0 border-t border-surface-3 p-3">
          {superchatNotice && (
            <div className="mb-2 rounded-md border border-brand-900/60 bg-brand-950/30 px-2.5 py-1.5 text-[11px] text-brand-200">
              {superchatNotice}
            </div>
          )}
          {blocked && (
            <div className="mb-2 rounded-md border border-red-900/60 bg-red-950/40 px-2.5 py-1.5 text-[11px] text-red-300">
              <Shield className="mr-1 inline h-3 w-3" />
              Blocked by AI moderation: {blocked}
            </div>
          )}
          {superchatError && (
            <div className="mb-2 rounded-md border border-red-900/60 bg-red-950/40 px-2.5 py-1.5 text-[11px] text-red-300">
              {superchatError}
            </div>
          )}
          {canSendSuperchat && (
            <div className="mb-2 rounded-xl border border-surface-3 bg-surface-2 p-2.5 shadow-xl/5">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowSuperchat((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-surface-4 bg-surface-1 px-2.5 py-1 text-xs font-semibold text-neutral-100 transition-colors hover:bg-surface-2"
                >
                  <DollarSign className="h-3.5 w-3.5 text-brand-400" />
                  Super Chat
                  <ChevronDown className={`h-3 w-3 text-neutral-500 transition-transform ${showSuperchat ? 'rotate-180' : ''}`} />
                </button>
                <span className="text-[10px] text-neutral-500">Card payment</span>
              </div>

              {showSuperchat && (
                <div className="space-y-2">
                  <div className="grid grid-cols-3 gap-1.5">
                    {[5, 10, 20].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setSuperchatAmount(String(preset))}
                        className={`rounded-lg border px-2 py-1 text-xs font-semibold transition-colors ${
                          Number(superchatAmount) === preset
                            ? 'border-brand-500/70 bg-brand-500 text-surface-0 hover:bg-brand-400'
                            : 'border-surface-3 bg-surface-1 text-neutral-200 hover:bg-surface-2'
                        }`}
                      >
                        ${preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <label htmlFor="superchat-amount" className="text-[11px] text-neutral-400">
                      Amount
                    </label>
                    <div className="flex h-8 w-28 items-center overflow-hidden rounded-lg bg-surface-1 ring-1 ring-surface-3 focus-within:ring-brand-500">
                      <span className="px-2 text-xs text-neutral-400">$</span>
                      <input
                        id="superchat-amount"
                        type="number"
                        min={SUPERCHAT_MIN_USD}
                        max={SUPERCHAT_MAX_USD}
                        step="1"
                        value={superchatAmount}
                        onChange={(e) => setSuperchatAmount(e.target.value)}
                        className="h-full w-full bg-transparent pr-2 text-sm text-neutral-100 focus:outline-none"
                      />
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={250}
                    value={superchatMessage}
                    onChange={(e) => setSuperchatMessage(e.target.value)}
                    placeholder="Your highlighted message..."
                    className="w-full resize-none rounded-lg bg-surface-1 px-2 py-1.5 text-xs text-neutral-100 placeholder-neutral-500 ring-1 ring-surface-3 transition-colors focus:outline-none focus:ring-brand-500"
                  />
                  <p className="text-[10px] text-neutral-500">
                    Min ${SUPERCHAT_MIN_USD} · Max ${SUPERCHAT_MAX_USD}
                  </p>
                  <Button
                    type="button"
                    onClick={startSuperchatCheckout}
                    disabled={superchatLoading}
                    size="sm"
                    className="h-8 w-full gap-1.5"
                  >
                    <DollarSign className="h-3.5 w-3.5" />
                    {superchatLoading ? 'Starting checkout...' : 'Pay by card'}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* GIF picker panel */}
          {showGif && (
            <div ref={gifRef} className="mb-2 rounded-xl border border-surface-3 bg-surface-2 p-2 shadow-xl">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-surface-1 px-2 py-1.5 ring-1 ring-surface-3 focus-within:ring-brand-500">
                  <Search className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
                  <input
                    autoFocus
                    value={gifQuery}
                    onChange={e => setGifQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchGifs(gifQuery)}
                    placeholder="Search GIFs..."
                    className="w-full bg-transparent text-xs text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
                  />
                </div>
                <button onClick={() => searchGifs(gifQuery)} className="rounded-lg bg-brand-500 px-2 py-1.5 text-xs font-semibold text-black hover:bg-brand-400">
                  Go
                </button>
                <button onClick={() => setShowGif(false)} className="text-neutral-400 hover:text-neutral-200">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {gifLoading && <p className="py-4 text-center text-xs text-neutral-500">Searching…</p>}
              {!gifLoading && gifs.length === 0 && gifQuery && (
                <p className="py-4 text-center text-xs text-neutral-500">No GIFs found</p>
              )}
              {!gifLoading && gifs.length === 0 && !gifQuery && (
                <p className="py-4 text-center text-xs text-neutral-500">Type to search GIFs</p>
              )}
              <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto">
                {gifs.map(g => (
                  <button
                    key={g.id}
                    onClick={() => sendGif(g.url)}
                    className="overflow-hidden rounded-lg hover:opacity-80 transition-opacity"
                    title={g.title}
                  >
                    <img src={g.preview} alt={g.title} className="h-20 w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Emoji picker panel */}
          {showEmoji && (
            <div ref={emojiRef} className="mb-2">
              <EmojiPicker
                onEmojiClick={insertEmoji}
                width="100%"
                height={320}
                searchDisabled={false}
                skinTonesDisabled
                previewConfig={{ showPreview: false }}
              />
            </div>
          )}

          <form onSubmit={send} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => { setShowEmoji(v => !v); setShowGif(false) }}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-2 hover:text-neutral-200 transition-colors"
              title="Emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { setShowGif(v => !v); setShowEmoji(false) }}
              className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-400 hover:bg-surface-2 hover:text-neutral-200 transition-colors"
              title="GIF"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <div className="flex h-10 flex-1 items-center overflow-hidden rounded-full bg-surface-2 ring-1 ring-surface-3 focus-within:ring-brand-500">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Say something or @StreamBot..."
                maxLength={500}
                className="h-full w-full bg-transparent px-4 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
              />
            </div>
            <Button type="submit" size="sm" disabled={!text.trim()} className="shrink-0 gap-1 !rounded-full !h-10 !w-10 !p-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="mt-1.5 text-[10px] text-neutral-500">
            Tip: start a message with <span className="font-semibold text-brand-400">@StreamBot</span> to chat with the AI.
          </p>
        </div>
      ) : (
        <p className="border-t border-surface-3 p-4 text-center text-xs text-neutral-500">
          Sign in to chat
        </p>
      )}
    </aside>
  )
}
