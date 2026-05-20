'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { UploadCloud, Film, Sparkles, X, Wand2, Check, Link2, Loader2 } from 'lucide-react'

const CATEGORIES = ['Gaming', 'Music', 'Podcasts', 'Sports', 'News', 'Film', 'IRL', 'Tech', 'Cooking', 'Education']
const TONES = [
  { key: 'hype' as const, label: 'Hype' },
  { key: 'friendly' as const, label: 'Friendly' },
  { key: 'informative' as const, label: 'Informative' },
  { key: 'minimal' as const, label: 'Minimal' }
]
const MAX_UI_FILE_BYTES = 2 * 1024 * 1024 * 1024

export default function UploadPage() {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState('')
  const [category, setCategory] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [tone, setTone] = useState<'hype' | 'friendly' | 'informative' | 'minimal'>('friendly')
  const [hints, setHints] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [progress, setProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMeta, setAiMeta] = useState<{ fallback?: boolean; hashtags?: string[] } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [mode, setMode] = useState<'file' | 'link'>('file')
  const [linkUrl, setLinkUrl] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  function pickFile(f: File | null) {
    setError(null)
    if (!f) return
    if (!f.type.startsWith('video/')) {
      setError('Please select a video file.')
      return
    }
    if (f.size > MAX_UI_FILE_BYTES) {
      setError('File too large. Max 2GB.')
      return
    }
    setFile(f)
  }

  async function generateWithAI() {
    if (!title.trim()) {
      setError('Add a title first so the AI knows what to write about.')
      return
    }
    setAiLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, category: category || null, hints: hints || null, mode: 'video', tone })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'AI failed')
      const data = json.data
      if (data.description) setDescription(data.description)
      if (Array.isArray(data.tags) && data.tags.length > 0) {
        setTags(data.tags.join(', '))
      }
      setAiMeta({ fallback: data.fallback, hashtags: data.hashtags })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'link') { void submitViaLink(); return }
    if (!file) { setError('Please select a video file.'); return }
    setLoading(true)
    setError(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title)
    fd.append('description', description)
    fd.append('tags', tags)
    if (thumbnailUrl.trim()) fd.append('thumbnail_url', thumbnailUrl.trim())
    if (category) fd.append('category', category)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/videos')
    xhr.upload.addEventListener('progress', (ev) => {
      if (ev.lengthComputable) setProgress(Math.round((ev.loaded / ev.total) * 100))
    })
    xhr.onload = () => {
      setLoading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        try { router.push(`/watch/${JSON.parse(xhr.responseText).data.id}`) }
        catch { router.push('/dashboard') }
      } else {
        try {
          const parsed = JSON.parse(xhr.responseText) as { error?: string }
          setError(typeof parsed.error === 'string' ? parsed.error : 'Upload failed')
        } catch {
          if (xhr.status === 413) {
            setError('Upload failed: payload too large for the current server/proxy limit.')
          } else {
            setError(`Upload failed (${xhr.status})`)
          }
        }
      }
    }
    xhr.onerror = () => { setLoading(false); setError('Network error during upload') }
    xhr.send(fd)
  }

  async function submitViaLink() {
    if (!linkUrl.trim()) { setError('Please enter a video URL.'); return }
    if (!title.trim()) { setError('Please enter a title.'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/videos/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: linkUrl.trim(), title, description, category, tags, thumbnail_url: thumbnailUrl.trim() })
      })
      const json = await res.json() as { data?: { id: string }; error?: string }
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'Import failed')
      router.push(`/watch/${json.data!.id}`)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          icon={UploadCloud}
          eyebrow="Creator Studio"
          title="Upload video"
          subtitle="Share a video with your audience. Let AI write your description."
          accent="brand"
        />

        <form onSubmit={submit} className="space-y-5">
          {/* Mode tabs */}
          <div className="flex gap-1 rounded-xl border border-surface-3 bg-surface-1 p-1">
            <button
              type="button"
              onClick={() => { setMode('file'); setError(null) }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === 'file' ? 'bg-brand-500 text-black' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <UploadCloud className="h-4 w-4" />
              Upload file
            </button>
            <button
              type="button"
              onClick={() => { setMode('link'); setError(null) }}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition-colors ${
                mode === 'link' ? 'bg-brand-500 text-black' : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <Link2 className="h-4 w-4" />
              Import via link
            </button>
          </div>

          {/* Link import panel */}
          {mode === 'link' && (
            <div className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-500/10 ring-1 ring-brand-500/30">
                  <Link2 className="h-5 w-5 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Direct video URL</p>
                  <p className="text-xs text-neutral-500">Paste a public direct link to an MP4, WebM, MOV, or other video file.</p>
                </div>
              </div>
              <input
                type="url"
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
                placeholder="https://example.com/video.mp4"
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-4 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                required={mode === 'link'}
              />
              <p className="mt-2 text-[11px] text-neutral-500">
                Supported: direct links ending in .mp4 .webm .mov .avi .mkv and more. YouTube or streaming pages are not supported — use a direct file URL.
              </p>
            </div>
          )}

          {/* File dropzone */}
          {mode === 'file' && <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault(); setDragOver(false)
              pickFile(e.dataTransfer.files?.[0] ?? null)
            }}
            className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
              dragOver ? 'border-brand-500 bg-brand-500/5' : 'border-surface-3 bg-surface-1 hover:bg-surface-2'
            }`}
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 ring-1 ring-brand-500/30">
              <UploadCloud className="h-7 w-7 text-brand-400" />
            </div>
            <p className="text-sm font-semibold text-neutral-100">Drag &amp; drop a video</p>
            <p className="mt-1 text-xs text-neutral-500">MP4, MOV, WebM - up to 2GB (some deployments cap file uploads lower)</p>
            <input
              ref={fileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
            />
            <Button type="button" variant="primary" size="md" className="mt-5 gap-2" onClick={() => fileRef.current?.click()}>
              <Film className="h-4 w-4" />
              Select file
            </Button>
            {file && (
              <div className="mt-5 flex w-full max-w-md items-center justify-between gap-3 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-left">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-neutral-100">{file.name}</p>
                  <p className="text-[11px] text-neutral-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="rounded-md p-1 text-neutral-400 hover:bg-surface-3 hover:text-white"
                  aria-label="Remove"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>}

          {/* Basics */}
          <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
            <h2 className="mb-4 text-base font-bold">Basics</h2>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Title</label>
                <Input
                  placeholder="An attention-grabbing title…"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  maxLength={200}
                />
                <p className="mt-1 text-[11px] text-neutral-500">{title.length}/200</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Category</label>
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
            </div>
          </section>

          <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
            <h2 className="mb-4 text-base font-bold">Thumbnail</h2>
            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Thumbnail URL</label>
                <Input
                  type="url"
                  placeholder="https://example.com/thumbnail.jpg"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  maxLength={1000}
                />
                <p className="mt-1 text-[11px] text-neutral-500">Use a public image URL. Recommended ratio: 16:9.</p>
              </div>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-surface-2 ring-1 ring-surface-3">
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="Thumbnail preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-neutral-500">No thumbnail</div>
                )}
              </div>
            </div>
          </section>

          {/* AI description */}
          <section className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-surface-1 via-surface-1 to-brand-500/5 p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/30">
                  <Sparkles className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold">AI description</h2>
                  <p className="text-xs text-neutral-500">Let AI draft a description + tags from your title.</p>
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={generateWithAI}
                disabled={aiLoading || !title.trim()}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                {aiLoading ? 'Generating…' : 'Generate'}
              </Button>
            </div>

            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Tone</label>
                <div className="flex flex-wrap gap-1.5">
                  {TONES.map((t) => (
                    <button
                      type="button"
                      key={t.key}
                      onClick={() => setTone(t.key)}
                      className={`chip !h-7 !text-xs ${tone === t.key ? 'chip-active' : ''}`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Hints (optional)</label>
                <Input
                  placeholder="e.g. speed-run, reaction, tutorial"
                  value={hints}
                  onChange={(e) => setHints(e.target.value)}
                  maxLength={600}
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Description</label>
              <textarea
                className="min-h-[160px] w-full rounded-lg border border-surface-3 bg-surface-1 p-4 text-sm text-neutral-100 placeholder-neutral-500 transition-colors focus:border-brand-500 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                placeholder="Description — or click Generate to draft one with AI."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={5000}
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] text-neutral-500">{description.length}/5000</p>
                {aiMeta && (
                  <p className="text-[11px] text-brand-400 inline-flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {aiMeta.fallback ? 'Drafted locally (no API key)' : 'AI draft applied'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Tags</label>
              <Input
                placeholder="comma, separated, tags"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
              {aiMeta?.hashtags && aiMeta.hashtags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {aiMeta.hashtags.map((h) => (
                    <span key={h} className="rounded-md bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-300 ring-1 ring-brand-500/20">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </section>

          {error && (
            <div className="rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          {loading && (
            <div className="rounded-xl border border-surface-3 bg-surface-1 p-4">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold">
                <span className="text-neutral-300">Uploading…</span>
                <span className="text-brand-400 tabular-nums">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
                <div className="h-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={loading || (mode === 'file' ? !file : !linkUrl.trim()) || !title.trim()}
              className="gap-2"
            >
              {loading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : mode === 'link' ? <Link2 className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />
              }
              {loading
                ? (mode === 'file' ? `Uploading ${progress}%` : 'Importing…')
                : (mode === 'link' ? 'Import & publish' : 'Publish video')
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
