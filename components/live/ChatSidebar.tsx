'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { io, Socket } from 'socket.io-client'
import { Button } from '@/components/ui/Button'
import { Bot, Send, Shield, Sparkles, Users, Smile, ImageIcon, X, Search } from 'lucide-react'

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

export function ChatSidebar({
  streamId,
  userId,
  username
}: {
  streamId: string
  userId: string | null
  username: string | null
}) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [text, setText] = useState('')
  const [viewers, setViewers] = useState(0)
  const [blocked, setBlocked] = useState<string | null>(null)
  const [botThinking, setBotThinking] = useState(false)
  const [usingPolling, setUsingPolling] = useState(false)
  const [realtimeUnavailable, setRealtimeUnavailable] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showGif, setShowGif] = useState(false)
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

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  function insertEmoji(emojiData: { emoji: string }) {
    setText(prev => prev + emojiData.emoji)
    setShowEmoji(false)
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
    <aside className="flex h-[500px] flex-col border-t border-surface-3 bg-surface-1 lg:h-full lg:border-l lg:border-t-0">
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

      <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 && (
          <li className="mt-8 text-center text-xs text-neutral-500">
            Be the first to say hi
          </li>
        )}
        {messages.map((m) => (
          <li
            key={m.id}
            className={`group rounded-lg px-2 py-1.5 text-sm leading-snug transition-colors hover:bg-surface-2 ${
              m.bot ? 'bg-brand-500/5 ring-1 ring-brand-500/20' : ''
            }`}
          >
            <div className="flex items-center gap-1.5">
              {m.bot ? (
                <span className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-surface-0">
                  <Bot className="h-3 w-3" />
                  {m.username}
                </span>
              ) : (
                <span className="font-semibold text-brand-400">{m.username}</span>
              )}
              {m.flagged && (
                <span
                  className="inline-flex items-center gap-0.5 rounded bg-amber-500/15 px-1 py-0.5 text-[9px] font-semibold uppercase text-amber-300 ring-1 ring-amber-500/30"
                  title={`Flagged: ${m.flagged}`}
                >
                  <Shield className="h-2.5 w-2.5" />
                  flagged
                </span>
              )}
            </div>
            {/^\[gif:(https?:\/\/[^\]]+)\]$/.test(m.content) ? (
              <img
                src={m.content.slice(5, -1)}
                alt="GIF"
                className="mt-1 max-h-32 rounded-lg object-contain"
                loading="lazy"
              />
            ) : (
              <p className={`mt-0.5 break-words ${m.bot ? 'text-neutral-100' : 'text-neutral-200'}`}>
                {m.content}
              </p>
            )}
          </li>
        ))}
        {botThinking && (
          <li className="rounded-lg bg-brand-500/5 px-2 py-1.5 text-sm ring-1 ring-brand-500/20">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 rounded-md bg-brand-500 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-surface-0">
                <Bot className="h-3 w-3" />
                StreamBot
              </span>
              <span className="flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
              </span>
            </div>
          </li>
        )}
      </ul>

      {userId ? (
        <div className="shrink-0 border-t border-surface-3 p-3">
          {blocked && (
            <div className="mb-2 rounded-md border border-red-900/60 bg-red-950/40 px-2.5 py-1.5 text-[11px] text-red-300">
              <Shield className="mr-1 inline h-3 w-3" />
              Blocked by AI moderation: {blocked}
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
