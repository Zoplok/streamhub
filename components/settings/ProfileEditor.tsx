'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { User, CheckCircle2 } from 'lucide-react'

const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,32}$/

export function ProfileEditor({
  username: initialUsername,
  email,
  roleName,
  joinedAt,
  avatarUrl
}: {
  username: string
  email: string
  roleName: string
  joinedAt?: string | null
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [username, setUsername] = useState(initialUsername)
  const [avatar, setAvatar] = useState(avatarUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reauthNeeded, setReauthNeeded] = useState(false)

  const normalizedUsername = username.trim()
  const normalizedInitialUsername = initialUsername.trim()
  const normalizedAvatar = avatar.trim()
  const normalizedInitialAvatar = (avatarUrl ?? '').trim()

  const usernameValid = useMemo(() => USERNAME_REGEX.test(normalizedUsername), [normalizedUsername])
  const changed = normalizedUsername !== normalizedInitialUsername || normalizedAvatar !== normalizedInitialAvatar
  const canSave = changed && usernameValid && !saving

  const initial = normalizedUsername[0]?.toUpperCase() ?? 'U'

  async function saveProfile() {
    setSaving(true)
    setNotice(null)
    setError(null)
    setReauthNeeded(false)
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: normalizedUsername,
          avatar_url: normalizedAvatar || null
        })
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to update profile')
      setNotice('Profile updated successfully.')
      setReauthNeeded(Boolean(json?.data?.requires_reauth))
      router.refresh()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-surface-3 bg-surface-1 p-6">
      <div className="mb-4 flex items-center gap-2">
        <User className="h-4 w-4 text-brand-400" />
        <h2 className="text-base font-bold">Profile</h2>
      </div>

      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-extrabold text-surface-0 shadow-glow">
          {normalizedAvatar
            ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={normalizedAvatar} alt={normalizedUsername} className="h-full w-full object-cover" />
            )
            : initial
          }
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-200">{email}</p>
          <p className="mt-1 text-xs text-neutral-500">
            Role: <span className="font-semibold uppercase tracking-wider text-brand-400">{roleName}</span>
            {joinedAt && (
              <>
                <span className="mx-1.5">·</span>
                Joined {new Date(joinedAt).toLocaleDateString()}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Username</label>
          <Input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={32}
            placeholder="your_name"
            autoComplete="username"
          />
          {!usernameValid && (
            <p className="mt-1 text-[11px] text-red-400">Use 3-32 chars: letters, numbers, underscore, or hyphen.</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-neutral-400">Avatar URL</label>
          <Input
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            type="url"
            placeholder="https://.../avatar.jpg"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" onClick={saveProfile} disabled={!canSave}>
          {saving ? 'Saving...' : 'Save profile'}
        </Button>
        {notice && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {notice}
          </span>
        )}
      </div>

      {reauthNeeded && (
        <div className="mt-3 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-xs text-fg">
          Username was updated. Sign in again to refresh your session across all pages.
          <div className="mt-2">
            <Link href="/login?callbackUrl=/settings">
              <Button type="button" size="sm" variant="outline">Sign in again</Button>
            </Link>
          </div>
        </div>
      )}
      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}
    </section>
  )
}
