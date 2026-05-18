'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Camera, Sparkles, CheckCircle2 } from 'lucide-react'
import type { Role } from '@/types'

export function ViewerStarterPanel({
  username,
  role,
  avatarUrl
}: {
  username: string
  role: Role
  avatarUrl: string | null
}) {
  const router = useRouter()
  const [avatar, setAvatar] = useState(avatarUrl ?? '')
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [avatarNotice, setAvatarNotice] = useState<string | null>(null)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const [becomingCreator, setBecomingCreator] = useState(false)
  const [creatorNotice, setCreatorNotice] = useState<string | null>(null)
  const [creatorError, setCreatorError] = useState<string | null>(null)
  const [reauthNeeded, setReauthNeeded] = useState(false)

  const initial = useMemo(() => username?.[0]?.toUpperCase() ?? 'U', [username])
  const normalizedAvatar = avatar.trim()
  const normalizedInitialAvatar = (avatarUrl ?? '').trim()
  const avatarChanged = normalizedAvatar !== normalizedInitialAvatar

  async function saveAvatar() {
    setSavingAvatar(true)
    setAvatarNotice(null)
    setAvatarError(null)
    try {
      const res = await fetch('/api/me/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: normalizedAvatar || null })
      })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to save profile picture')
      setAvatarNotice('Profile picture updated.')
      router.refresh()
    } catch (err) {
      setAvatarError((err as Error).message)
    } finally {
      setSavingAvatar(false)
    }
  }

  async function becomeCreator() {
    setBecomingCreator(true)
    setCreatorNotice(null)
    setCreatorError(null)
    try {
      const res = await fetch('/api/me/become-creator', { method: 'POST' })
      const json = await res.json().catch(() => null)
      if (!res.ok) throw new Error(typeof json?.error === 'string' ? json.error : 'Failed to upgrade account')
      setCreatorNotice('You are now a creator. Sign in again to refresh creator permissions.')
      setReauthNeeded(Boolean(json?.data?.requires_reauth))
      router.refresh()
    } catch (err) {
      setCreatorError((err as Error).message)
    } finally {
      setBecomingCreator(false)
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <section className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Camera className="h-4 w-4 text-brand-400" />
          <h2 className="text-base font-bold">Profile picture</h2>
        </div>
        <p className="mb-4 text-sm text-fg-muted">
          Add an avatar so your comments and profile stand out.
        </p>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-extrabold text-surface-0">
            {normalizedAvatar
              ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={normalizedAvatar} alt={username} className="h-full w-full object-cover" />
              )
              : initial
            }
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-fg">{username}</p>
            <p className="text-xs text-fg-subtle">Square image works best.</p>
          </div>
        </div>
        <div className="space-y-3">
          <Input
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
            placeholder="https://.../avatar.jpg"
            type="url"
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={saveAvatar}
            disabled={savingAvatar || !avatarChanged}
            className="w-full"
          >
            {savingAvatar ? 'Saving...' : 'Save profile picture'}
          </Button>
        </div>
        {avatarNotice && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {avatarNotice}
          </p>
        )}
        {avatarError && (
          <p className="mt-3 text-xs text-red-400">{avatarError}</p>
        )}
      </section>

      <section className="rounded-xl border border-surface-3 bg-surface-1 p-5">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-brand-400" />
          <h2 className="text-base font-bold">Become a creator</h2>
        </div>
        <p className="mb-4 text-sm text-fg-muted">
          Unlock uploads, shorts, live streaming, and creator analytics.
        </p>
        {role === 'viewer' ? (
          <>
            <Button
              type="button"
              size="sm"
              onClick={becomeCreator}
              disabled={becomingCreator}
              className="w-full"
            >
              {becomingCreator ? 'Upgrading account...' : 'Become creator'}
            </Button>
            {creatorNotice && (
              <div className="mt-3 rounded-md border border-brand-500/40 bg-brand-500/10 px-3 py-2 text-xs text-fg">
                {creatorNotice}
              </div>
            )}
            {reauthNeeded && (
              <div className="mt-2">
                <Link href="/login?callbackUrl=/dashboard">
                  <Button type="button" size="sm" variant="outline" className="w-full">
                    Sign in again
                  </Button>
                </Link>
              </div>
            )}
            {creatorError && (
              <p className="mt-3 text-xs text-red-400">{creatorError}</p>
            )}
          </>
        ) : (
          <p className="text-sm text-fg-muted">
            Your account already has creator access. Refresh this page to continue.
          </p>
        )}
      </section>
    </div>
  )
}
