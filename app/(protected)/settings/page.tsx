import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/ui/PageHeader'
import { Settings as SettingsIcon, User, Shield, Bell, Palette } from 'lucide-react'
import Link from 'next/link'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/settings')

  const res = await db.query<{ username: string; email: string; created_at: string; role_name: string }>(
    `SELECT u.username, u.email, u.created_at, r.name AS role_name
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? LIMIT 1`,
    [session.user.id]
  )
  const me = res.rows[0]
  const initial = me?.username?.[0]?.toUpperCase() ?? 'U'

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <PageHeader
          icon={SettingsIcon}
          eyebrow="Account"
          title="Settings"
          subtitle="Manage your profile, preferences, and security."
          accent="blue"
        />

        {/* Profile */}
        <section className="mb-6 rounded-2xl border border-surface-3 bg-surface-1 p-6">
          <div className="mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-brand-400" />
            <h2 className="text-base font-bold">Profile</h2>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-xl font-extrabold text-surface-0 shadow-glow">
              {initial}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold">{me?.username}</p>
              <p className="text-sm text-neutral-400">{me?.email}</p>
              <p className="mt-1 text-xs text-neutral-500">
                Role: <span className="font-semibold uppercase tracking-wider text-brand-400">{me?.role_name}</span>
                {me?.created_at && (
                  <>
                    <span className="mx-1.5">·</span>
                    Joined {new Date(me.created_at).toLocaleDateString()}
                  </>
                )}
              </p>
            </div>
          </div>
        </section>

        {/* Creator tools */}
        {['admin', 'creator'].includes(session.user.role) && (
          <section className="mb-6 rounded-2xl border border-surface-3 bg-surface-1 p-6">
            <div className="mb-4 flex items-center gap-2">
              <Palette className="h-4 w-4 text-brand-400" />
              <h2 className="text-base font-bold">Creator</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Link href="/dashboard" className="rounded-xl border border-surface-3 bg-surface-2 p-4 transition-colors hover:border-brand-500/40">
                <p className="text-sm font-semibold text-neutral-100">Dashboard</p>
                <p className="mt-0.5 text-xs text-neutral-500">Stats, videos, streams.</p>
              </Link>
              <Link href="/dashboard/channel" className="rounded-xl border border-surface-3 bg-surface-2 p-4 transition-colors hover:border-brand-500/40">
                <p className="text-sm font-semibold text-neutral-100">Customize channel</p>
                <p className="mt-0.5 text-xs text-neutral-500">Banner, avatar, description.</p>
              </Link>
              <Link href="/upload" className="rounded-xl border border-surface-3 bg-surface-2 p-4 transition-colors hover:border-brand-500/40">
                <p className="text-sm font-semibold text-neutral-100">Upload video</p>
                <p className="mt-0.5 text-xs text-neutral-500">Publish a new video.</p>
              </Link>
            </div>
          </section>
        )}

        {/* Preferences (visual only for now) */}
        <section className="mb-6 rounded-2xl border border-surface-3 bg-surface-1 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Bell className="h-4 w-4 text-brand-400" />
            <h2 className="text-base font-bold">Preferences</h2>
          </div>
          <div className="divide-y divide-surface-3">
            {[
              { label: 'Email me about new subscribers', on: true },
              { label: 'Email me about comments and mentions', on: true },
              { label: 'Autoplay next video', on: true },
              { label: 'Show mature content', on: false }
            ].map((p) => (
              <div key={p.label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                <span className="text-sm text-neutral-200">{p.label}</span>
                <span
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    p.on ? 'bg-brand-500' : 'bg-surface-4'
                  }`}
                  aria-hidden="true"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      p.on ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-[11px] text-neutral-500">Preferences are display-only in this build.</p>
        </section>

        {/* Security */}
        <section className="rounded-2xl border border-surface-3 bg-surface-1 p-6">
          <div className="mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4 text-brand-400" />
            <h2 className="text-base font-bold">Security</h2>
          </div>
          <p className="text-sm text-neutral-400">
            Password changes and two-factor authentication are coming soon. For urgent account issues, contact an admin.
          </p>
        </section>
      </div>
    </div>
  )
}
