'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { UploadCloud, Film, Check, X, Sparkles, Wand2 } from 'lucide-react'

const MAX_BYTES = 100 * 1024 * 1024 // 100MB
const MAX_DURATION = 60
const TONES = [
  { key: 'hype', label: 'Hype' },
  { key: 'friendly', label: 'Friendly' },
  { key: 'informative', label: 'Informative' },
  { key: 'minimal', label: 'Minimal' }
] as const

export function ShortUploader() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState('')
  const [hints, setHints] = useState('')
  const [tone, setTone] = useState<(typeof TONES)[number]['key']>('friendly')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiMeta, setAiMeta] = useState<{ fallback?: boolean; hashtags?: string[] } | null>(null)
  const [progress, setProgress] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  function pickFile(f: File | null) {
    setError(null)
    if (!f) return
    if (!f.type.startsWith('video/')) {
      setError('Please select a video file.')
      return
    }
    if (f.size > MAX_BYTES) {
      setError('File too large. Max 100MB.')
      return
    }
    setFile(f)
    const url = URL.createObjectURL(f)
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
  }

  function onFileMeta(e: React.SyntheticEvent<HTMLVideoElement>) {
    const d = Math.round((e.currentTarget as HTMLVideoElement).duration)
    setDuration(d)
    if (d > MAX_DURATION) {
      setError(`Video is ${d}s — max length is ${MAX_DURATION}s.`)
    }
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setFile(null)
    setDuration(null)
    setProgress(0)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
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
        body: JSON.stringify({ title, hints: hints || null, mode: 'short', tone })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(typeof json.error === 'string' ? json.error : 'AI failed')
      const data = json.data
      if (data.description) setDescription(data.description)
      setAiMeta({ fallback: data.fallback, hashtags: data.hashtags })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setAiLoading(false)
    }
  }

  function upload() {
    if (!file || !title.trim()) {
      setError('Add a title and select a video.')
      return
    }
    if (duration && duration > MAX_DURATION) return

    setUploading(true)
    setProgress(0)
    setError(null)

    const fd = new FormData()
    fd.append('file', file)
    fd.append('title', title.trim())
    fd.append('description', description.trim())
    if (thumbnailUrl.trim()) fd.append('thumbnail_url', thumbnailUrl.trim())

    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/shorts', true)
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        setProgress(Math.round((ev.loaded / ev.total) * 100))
      }
    }
    xhr.onload = () => {
      setUploading(false)
      if (xhr.status >= 200 && xhr.status < 300) {
        setProgress(100)
        setTimeout(() => router.push('/shorts'), 600)
      } else {
        try {
          const j = JSON.parse(xhr.responseText)
          setError(typeof j.error === 'string' ? j.error : 'Upload failed')
        } catch {
          setError(`Upload failed (${xhr.status})`)
        }
      }
    }
    xhr.onerror = () => {
      setUploading(false)
      setError('Network error during upload')
    }
    xhr.send(fd)
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Main form */}
      <div className="space-y-5">
        <div className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Title
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="A punchy, short title…"
            maxLength={150}
            required
          />
          <p className="mt-1 text-[11px] text-neutral-500">{title.length}/150</p>
        </div>

        <div className="rounded-2xl border border-brand-500/20 bg-gradient-to-br from-surface-1 via-surface-1 to-brand-500/5 p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500/15 ring-1 ring-brand-500/30">
                <Sparkles className="h-4 w-4 text-brand-400" />
              </div>
              <div className="min-w-0">
                <h2 className="text-base font-bold">AI description</h2>
                <p className="text-xs text-neutral-500">Draft a short description from your title.</p>
              </div>
            </div>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={generateWithAI}
              disabled={aiLoading || !title.trim()}
              className="shrink-0 gap-2"
            >
              <Wand2 className="h-4 w-4" />
              {aiLoading ? 'Generating...' : 'Generate'}
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
                placeholder="e.g. behind the scenes, tutorial, reaction"
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                maxLength={600}
              />
            </div>
          </div>

          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Description
          </label>
          <textarea
            className="min-h-[130px] w-full rounded-lg border border-surface-3 bg-surface-1 p-4 text-sm text-neutral-100 placeholder-neutral-500 transition-colors focus:border-brand-500 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            placeholder="Add a description, or let AI draft one."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
          />
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-[11px] text-neutral-500">{description.length}/5000</p>
            {aiMeta && (
              <p className="inline-flex items-center gap-1 text-[11px] text-brand-400">
                <Check className="h-3 w-3" />
                {aiMeta.fallback ? 'Drafted locally' : 'AI draft applied'}
              </p>
            )}
          </div>
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

        <div className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-neutral-400">
            Thumbnail URL
          </label>
          <Input
            type="url"
            value={thumbnailUrl}
            onChange={(e) => setThumbnailUrl(e.target.value)}
            placeholder="https://example.com/short-cover.jpg"
            maxLength={1000}
          />
          <p className="mt-1 text-[11px] text-neutral-500">Optional public image URL. Recommended ratio: 9:16.</p>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            pickFile(e.dataTransfer.files?.[0] ?? null)
          }}
          className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-10 text-center transition-colors ${
            dragOver
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-surface-3 bg-surface-1 hover:bg-surface-2'
          }`}
        >
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-brand-500/10 ring-1 ring-brand-500/30">
            <UploadCloud className="h-7 w-7 text-brand-400" />
          </div>
          <p className="text-sm font-semibold text-neutral-100">Drag &amp; drop a video</p>
          <p className="mt-1 text-xs text-neutral-500">
            MP4, MOV, or WebM · up to 60s · up to 100MB
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="primary"
            size="md"
            className="mt-5 gap-2"
            onClick={() => fileRef.current?.click()}
          >
            <Film className="h-4 w-4" />
            Select file
          </Button>

          {file && (
            <div className="mt-5 flex w-full items-center justify-between gap-3 rounded-lg border border-surface-3 bg-surface-2 px-3 py-2 text-left">
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-neutral-100">{file.name}</p>
                <p className="text-[11px] text-neutral-500">
                  {(file.size / (1024 * 1024)).toFixed(1)} MB
                  {duration !== null && ` · ${duration}s`}
                </p>
              </div>
              <button
                type="button"
                onClick={reset}
                className="rounded-md p-1 text-neutral-400 hover:bg-surface-3 hover:text-white"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {uploading && (
          <div className="rounded-xl border border-surface-3 bg-surface-1 p-4">
            <div className="mb-2 flex items-center justify-between text-xs font-semibold">
              <span className="text-neutral-300">Uploading…</span>
              <span className="text-brand-400 tabular-nums">{progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-brand-300 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          {progress === 100 && !uploading && (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400">
              <Check className="h-4 w-4" />
              Published
            </span>
          )}
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={upload}
            disabled={!file || !title.trim() || uploading || (duration !== null && duration > MAX_DURATION)}
            className="gap-2"
          >
            <UploadCloud className="h-4 w-4" />
            {uploading ? 'Uploading…' : 'Publish short'}
          </Button>
        </div>
      </div>

      {/* Preview */}
      <aside className="lg:sticky lg:top-20">
        <div className="overflow-hidden rounded-2xl border border-surface-3 bg-surface-1">
          <div className="flex items-center gap-2 border-b border-surface-3 px-4 py-3">
            <Film className="h-4 w-4 text-brand-400" />
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Preview
            </span>
          </div>
          <div className="relative flex items-center justify-center bg-black" style={{ aspectRatio: '9 / 16' }}>
            {!previewUrl && thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt="Short thumbnail preview" className="h-full w-full object-cover" />
            )}
            {previewUrl ? (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                src={previewUrl}
                controls
                playsInline
                muted
                onLoadedMetadata={onFileMeta}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 p-6 text-center text-neutral-500">
                <Film className="h-8 w-8 opacity-60" />
                <p className="text-xs">Your short will appear here</p>
              </div>
            )}
          </div>
          {(title || description) && (
            <div className="border-t border-surface-3 p-4">
              {title && <p className="line-clamp-2 text-sm font-semibold text-neutral-100">{title}</p>}
              {description && <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-neutral-400">{description}</p>}
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}
