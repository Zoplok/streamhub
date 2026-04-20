'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Camera, Image as ImageIcon, Save, Check } from 'lucide-react'

interface Channel {
  id: string
  name: string
  description: string | null
  banner_url: string | null
  avatar_url: string | null
  category: string | null
}

const CATEGORIES = ['Gaming', 'Music', 'Podcasts', 'Sports', 'News', 'Film', 'IRL', 'Tech', 'Cooking', 'Education', 'Other']

export function ChannelEditor({ channel }: { channel: Channel }) {
  const router = useRouter()
  const [name, setName] = useState(channel.name)
  const [description, setDescription] = useState(channel.description ?? '')
  const [banner, setBanner] = useState(channel.banner_url ?? '')
  const [avatar, setAvatar] = useState(channel.avatar_url ?? '')
  const [category, setCategory] = useState(channel.category ?? '')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const initial = name[0]?.toUpperCase() ?? '?'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch(`/api/channels/${channel.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || null,
          banner_url: banner || null,
          avatar_url: avatar || null,
          category: category || null
        })
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(typeof j?.error === 'string' ? j.error : 'Update failed')
      }
      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Preview */}
      <div className="overflow-hidden rounded-2xl border border-surface-3 bg-surface-1">
        <div
          className="relative h-44 w-full bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300"
          style={banner ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-surface-1 via-transparent to-transparent" />
        </div>
        <div className="-mt-12 flex items-end gap-4 px-6 pb-6">
          <div className="relative">
            <div
              className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-3xl font-extrabold text-surface-0 ring-4 ring-surface-1"
              style={avatar ? { backgroundImage: `url(${avatar})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}
            >
              {!avatar && initial}
            </div>
          </div>
          <div className="pb-1">
            <p className="text-xl font-extrabold tracking-tight">{name || 'Your channel'}</p>
            <p className="text-xs text-neutral-400">{category || 'No category'}</p>
          </div>
        </div>
      </div>

      {/* Basics */}
      <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
        <h2 className="text-base font-bold">Basics</h2>
        <p className="text-xs text-neutral-400">Your public identity on StreamHub.</p>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Channel name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={80} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Tell viewers about your channel…"
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 transition-colors focus:border-brand-500 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
            />
            <p className="mt-1 text-[11px] text-neutral-500">{description.length}/2000</p>
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

      {/* Images */}
      <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
        <h2 className="text-base font-bold">Branding</h2>
        <p className="text-xs text-neutral-400">Add an avatar and banner to make your channel stand out.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <Camera className="h-3.5 w-3.5" />
              Avatar URL
            </label>
            <Input
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="https://…/avatar.jpg"
              type="url"
            />
            <p className="mt-1 text-[11px] text-neutral-500">Square image recommended (at least 200×200)</p>
          </div>
          <div>
            <label className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-400">
              <ImageIcon className="h-3.5 w-3.5" />
              Banner URL
            </label>
            <Input
              value={banner}
              onChange={(e) => setBanner(e.target.value)}
              placeholder="https://…/banner.jpg"
              type="url"
            />
            <p className="mt-1 text-[11px] text-neutral-500">Wide image recommended (at least 2048×384)</p>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-400">
            <Check className="h-4 w-4" />
            Saved
          </span>
        )}
        <Button type="submit" variant="primary" size="md" disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? 'Saving…' : 'Save changes'}
        </Button>
      </div>
    </form>
  )
}
