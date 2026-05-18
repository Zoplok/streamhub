import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Settings as SettingsIcon, Shield, Palette } from 'lucide-react'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { PageHeader } from '@/components/ui/PageHeader'
import { SettingsPreferences } from '@/components/settings/SettingsPreferences'
import { ProfileEditor } from '@/components/settings/ProfileEditor'

export const dynamic = 'force-dynamic'

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

  let avatarUrl: string | null = null
  try {
    const channelRes = await db.query<{ avatar_url: string | null }>(
      `SELECT COALESCE(c.avatar_url, u.avatar_url) AS avatar_url
       FROM users u LEFT JOIN channels c ON c.user_id = u.id
       WHERE u.id=? LIMIT 1`,
      [session.user.id]
    )
    avatarUrl = channelRes.rows[0]?.avatar_url ?? null
  } catch {
    // avatar is not critical for rendering settings
  }

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

        <ProfileEditor
          username={me?.username ?? session.user.name ?? 'User'}
          email={me?.email ?? ''}
          roleName={me?.role_name ?? session.user.role}
          joinedAt={me?.created_at}
          avatarUrl={avatarUrl}
        />

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

        <SettingsPreferences />

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
