'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Radio,
  Sparkles,
  Wand2,
  Copy,
  Check,
  Eye,
  EyeOff,
  ExternalLink,
  ChevronRight,
  Video,
  AlertTriangle
} from 'lucide-react'

const CATEGORIES = ['Gaming', 'Music', 'IRL', 'Sports', 'News', 'Tech', 'Podcasts', 'Cooking', 'Art', 'Education']

export default function GoLivePage() {
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ id: string; stream_key: string; rtmp_url: string | null } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // AI title assist
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([])
  const [aiHint, setAiHint] = useState('')

  // Result UI state
  const [revealKey, setRevealKey] = useState(false)
  const [copied, setCopied] = useState<'url' | 'key' | null>(null)

  async function generateTitles() {
    const seed = aiHint.trim() || title.trim() || category || 'live stream'
    setAiLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: seed,
          category: category || null,
          hints: aiHint || null,
          mode: 'stream',
          tone: 'hype'
        })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'AI failed')

      // Build 3 candidate titles from the AI response.
      const desc: string = String(json.data?.description ?? '')
      const firstLine = desc.split(/\n|\.|—/).map((s) => s.trim()).filter(Boolean)[0] ?? ''
      const tags: string[] = Array.isArray(json.data?.tags) ? json.data.tags : []
      const base = seed
      const candidates = [
        firstLine.slice(0, 90) || `${base} — live now!`,
        tags.length > 0 ? `${base} · ${tags.slice(0, 3).map((t) => t.replace(/\s+/g, ' ')).join(' · ')}` : `${base} (going live)`,
        `🔴 LIVE: ${base}${category ? ` — ${category}` : ''}`
      ]
        .map((s) => s.replace(/["*_`]/g, '').slice(0, 120))
        .filter((s, i, arr) => s && arr.indexOf(s) === i)

      setAiSuggestions(candidates)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim()) {
      setError('Give your stream a title first.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/streams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category: category || null, thumbnail_url: thumbnailUrl.trim() || null })
      })
      const json = await res.json()
      if (!res.ok) {
        setError(typeof json.error === 'string' ? json.error : 'Failed to create stream')
        return
      }
      setResult(json.data)
    } finally {
      setLoading(false)
    }
  }

  async function copy(value: string, which: 'url' | 'key') {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      setError('Unable to copy. Select the text manually.')
    }
  }

  function maskedKey(k: string): string {
    if (revealKey) return k
    // Show first 6 + last 4, mask middle
    return k.length > 14 ? `${k.slice(0, 6)}${'•'.repeat(16)}${k.slice(-4)}` : '•'.repeat(k.length)
  }

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          icon={Radio}
          eyebrow="Creator Studio"
          title="Go live"
          subtitle={result ? 'Your stream is ready — configure OBS below and press Start Streaming.' : 'Create a live stream, then point OBS at the RTMP URL to go live.'}
          accent="brand"
        />

        {!result ? (
          <form onSubmit={create} className="space-y-5">
            {/* Basics */}
            <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
              <h2 className="mb-4 text-base font-bold">Stream details</h2>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Title
                  </label>
                  <Input
                    placeholder="What are you streaming?"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    maxLength={200}
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">{title.length}/200</p>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setCategory(category === c ? '' : c)}
                        className={`chip ${category === c ? 'chip-active' : ''}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
                    Live thumbnail URL
                  </label>
                  <Input
                    type="url"
                    placeholder="https://example.com/live-thumbnail.jpg"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    maxLength={1000}
                  />
                  <p className="mt-1 text-[11px] text-neutral-500">Optional public image URL. Recommended ratio: 16:9.</p>
                </div>
              </div>
            </section>

            {/* AI title assist */}
            <section className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-surface-1 via-surface-1 to-brand-500/5 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/30">
                    <Sparkles className="h-4 w-4 text-brand-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold">AI title ideas</h2>
                    <p className="text-xs text-neutral-500">
                      Stuck? Give a hint and let AI draft 3 title options.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={generateTitles}
                  disabled={aiLoading || (!aiHint.trim() && !title.trim() && !category)}
                  className="gap-2"
                >
                  <Wand2 className="h-4 w-4" />
                  {aiLoading ? 'Thinking…' : 'Suggest'}
                </Button>
              </div>

              <Input
                placeholder="Optional hint: 'Elden Ring DLC boss run', 'chill lo-fi beats'…"
                value={aiHint}
                onChange={(e) => setAiHint(e.target.value)}
                maxLength={300}
              />

              {aiSuggestions.length > 0 && (
                <div className="mt-4 space-y-2">
                  {aiSuggestions.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setTitle(s)}
                      className="group flex w-full items-center justify-between gap-3 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2.5 text-left text-sm transition-colors hover:border-brand-500/40 hover:bg-surface-3"
                    >
                      <span className="truncate">{s}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500 group-hover:text-brand-400" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            {error && (
              <div className="flex items-start gap-2 rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <Button type="submit" variant="primary" size="lg" disabled={loading || !title.trim()} className="gap-2">
                <Radio className="h-4 w-4" />
                {loading ? 'Creating…' : 'Create stream'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Success banner */}
            <div className="flex items-start gap-3 rounded-2xl border border-brand-500/30 bg-gradient-to-br from-brand-500/10 via-surface-1 to-surface-1 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500/20 ring-1 ring-brand-500/40">
                <Check className="h-5 w-5 text-brand-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-bold">Stream created!</h2>
                <p className="mt-1 text-sm text-neutral-400">
                  Paste the RTMP URL and stream key into OBS, then click <span className="font-semibold text-neutral-200">Start Streaming</span>.
                  Your viewers will see you on the live page within a few seconds.
                </p>
              </div>
            </div>

            {/* RTMP URL */}
            <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-neutral-200">RTMP ingest URL</h3>
                  <p className="text-[11px] text-neutral-500">Server URL in OBS → Settings → Stream</p>
                </div>
                <button
                  type="button"
                  onClick={() => result.rtmp_url && copy(result.rtmp_url, 'url')}
                  disabled={!result.rtmp_url}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-neutral-300 ring-1 ring-surface-3 hover:bg-surface-3 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {copied === 'url' ? <Check className="h-3.5 w-3.5 text-brand-400" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied === 'url' ? 'Copied' : 'Copy'}
                </button>
              </div>
              <code className="block break-all rounded-lg bg-black/50 p-3 font-mono text-xs text-neutral-200 ring-1 ring-surface-3">
                {result.rtmp_url ?? 'RTMP ingest URL is not configured.'}
              </code>
              {!result.rtmp_url && (
                <p className="mt-2 text-[11px] text-amber-300">
                  Set <code className="font-mono">NEXT_PUBLIC_RTMP_INGEST_URL</code> in your environment and redeploy.
                </p>
              )}
            </section>

            {/* Stream Key */}
            <section className="rounded-2xl border border-amber-500/20 bg-surface-1 p-6">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="flex items-center gap-1.5 text-sm font-bold text-neutral-200">
                    Stream key
                    <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 ring-1 ring-amber-500/30">
                      Secret
                    </span>
                  </h3>
                  <p className="text-[11px] text-neutral-500">Never share this. Treat it like a password.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setRevealKey((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-neutral-300 ring-1 ring-surface-3 hover:bg-surface-3 hover:text-white"
                  >
                    {revealKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {revealKey ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    onClick={() => copy(result.stream_key, 'key')}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-3 py-1.5 text-xs font-semibold text-neutral-300 ring-1 ring-surface-3 hover:bg-surface-3 hover:text-white"
                  >
                    {copied === 'key' ? <Check className="h-3.5 w-3.5 text-brand-400" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === 'key' ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
              <code className="block break-all rounded-lg bg-black/50 p-3 font-mono text-xs text-neutral-200 ring-1 ring-surface-3">
                {maskedKey(result.stream_key)}
              </code>
            </section>

            {/* OBS guide */}
            <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-neutral-200">
                <Video className="h-4 w-4 text-brand-400" />
                Setup in OBS (60 seconds)
              </h3>
              <ol className="space-y-3 text-sm text-neutral-300">
                {[
                  <>Open <strong>OBS Studio</strong> → <strong>Settings</strong> → <strong>Stream</strong>.</>,
                  <>Set <strong>Service</strong> to <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-xs">Custom…</span>.</>,
                  <>Paste the <strong>RTMP ingest URL</strong> into the <strong>Server</strong> field.</>,
                  <>Paste your <strong>stream key</strong> into the <strong>Stream Key</strong> field.</>,
                  <>Click <strong>OK</strong>, then <strong>Start Streaming</strong>.</>,
                  <>Open your stream page below to see yourself live & chat with viewers.</>
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-500/15 text-xs font-bold text-brand-400 ring-1 ring-brand-500/30">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </section>

            {/* Primary: Browser Studio */}
            <section className="rounded-2xl border border-brand-500/40 bg-gradient-to-br from-brand-500/15 via-surface-1 to-surface-1 p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex-1 min-w-[220px]">
                  <div className="mb-2 inline-flex items-center gap-1.5 rounded-md bg-brand-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-300 ring-1 ring-brand-500/40">
                    <Sparkles className="h-3 w-3" />
                    No install
                  </div>
                  <h3 className="text-base font-bold">Go live from your browser</h3>
                  <p className="mt-1 text-sm text-neutral-400">
                    Use StreamHub Studio — webcam, screen share, chat and stats, all in the tab. No OBS required.
                  </p>
                </div>
                <Link href={`/studio/${result.id}`} className="inline-block">
                  <Button variant="primary" size="lg" className="gap-2">
                    <Video className="h-4 w-4" />
                    Open Browser Studio
                  </Button>
                </Link>
              </div>
            </section>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-3 bg-surface-1 p-4">
              <p className="text-xs text-neutral-500">
                Prefer OBS or need higher bitrate? Use the RTMP credentials above. Stream shows as{' '}
                <span className="font-semibold text-amber-400">Idle</span> until an encoder connects.
              </p>
              <Link href={`/live/${result.id}`} className="inline-block">
                <Button variant="secondary" size="md" className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Viewer page
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
