import Link from 'next/link'
import type { Session } from '@/types'
import { auth } from '@/lib/auth'
import { Button } from './Button'
import { SearchBar } from './SearchBar'
import { Video, Radio, User, ShieldCheck } from 'lucide-react'
import { NotificationBell } from './NotificationBell'
import { ThemeToggle } from './ThemeToggle'
import { MobileMenuButton } from './MobileMenuButton'
import { AuthSignOutButton } from './SignOutButton'
import { db } from '@/lib/db'

export async function Navbar() {
  const session = await auth()
  const isCreator = session?.user && ['admin', 'creator'].includes(session.user.role)
  const isModerator = session?.user && ['admin', 'moderator'].includes(session.user.role)
  const initial = session?.user?.name?.[0]?.toUpperCase() ?? 'U'
  let avatarUrl = session?.user?.image ?? null
  if (session?.user) {
    try {
      const r = await db.query<{ avatar_url: string | null }>(
        `SELECT COALESCE(c.avatar_url, u.avatar_url) AS avatar_url
         FROM users u LEFT JOIN channels c ON c.user_id = u.id
         WHERE u.id=? LIMIT 1`,
        [session.user.id]
      )
      avatarUrl = r.rows[0]?.avatar_url ?? avatarUrl
    } catch {}
  }

  return (
    <header className="sticky top-0 z-40 border-b border-surface-3 bg-surface-0/90 backdrop-blur">
      <div className="flex flex-col gap-2 px-3 py-2 sm:h-14 sm:flex-row sm:items-center sm:gap-3 sm:px-4 sm:py-0 md:gap-4 md:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:contents">
          <MobileMenuButton />

          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-surface-0 shadow-glow">
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
            <span className="hidden text-lg font-extrabold tracking-tight text-fg sm:inline">
              Stream<span className="text-brand-500">Hub</span>
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 justify-end sm:hidden">
            <div className="flex shrink-0 items-center gap-0.5">
              <MobileActions
                session={session}
                isCreator={Boolean(isCreator)}
                isModerator={Boolean(isModerator)}
                initial={initial}
                avatarUrl={avatarUrl}
              />
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 justify-center sm:ml-2">
          <SearchBar />
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
          <ThemeToggle />
          {isCreator && (
            <>
              <Link
                href="/go-live"
                className="hidden items-center gap-2 rounded-full bg-red-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-500 sm:inline-flex"
              >
                <Radio className="h-4 w-4" />
                Go Live
              </Link>
              <Link
                href="/upload"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-surface-2 hover:text-neutral-100"
                aria-label="Upload"
              >
                <Video className="h-5 w-5" />
              </Link>
            </>
          )}

          {session?.user ? (
            <>
              <NotificationBell />
              {session.user.role === 'admin' && (
                <Link
                  href="/admin"
                  className="hidden rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-brand-400 hover:bg-surface-2 hover:text-brand-300 md:inline-block"
                >
                  Admin
                </Link>
              )}
              {isModerator && (
                <Link
                  href="/moderator"
                  className="hidden items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold uppercase tracking-wider text-brand-400 hover:bg-surface-2 hover:text-brand-300 md:inline-flex"
                >
                  <ShieldCheck className="h-4 w-4" />
                  Mod
                </Link>
              )}
              <Link
                href="/dashboard"
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-surface-0"
                title={session.user.name ?? 'You'}
              >
                {avatarUrl
                  ? <img src={avatarUrl} alt={session.user.name ?? 'You'} className="h-full w-full object-cover" />
                  : initial
                }
              </Link>
              <div className="hidden sm:block">
                <AuthSignOutButton />
              </div>
            </>
          ) : (
            <>
              <Link href="/login">
                <Button size="sm" variant="ghost" className="gap-2">
                  <User className="h-4 w-4" />
                  Sign in
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm">Sign up</Button>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

function AvatarLink({
  initial,
  avatarUrl,
  name
}: {
  initial: string
  avatarUrl: string | null
  name?: string | null
}) {
  return (
    <Link
      href="/dashboard"
      className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-surface-0"
      title={name ?? 'You'}
    >
      {avatarUrl
        ? <img src={avatarUrl} alt={name ?? 'You'} className="h-full w-full object-cover" />
        : initial
      }
    </Link>
  )
}

function MobileActions({
  session,
  isCreator,
  isModerator,
  initial,
  avatarUrl
}: {
  session: Session | null
  isCreator: boolean
  isModerator: boolean
  initial: string
  avatarUrl: string | null
}) {
  if (session?.user) {
    return (
      <>
        {isCreator && (
          <Link
            href="/upload"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-surface-2 hover:text-neutral-100"
            aria-label="Upload"
          >
            <Video className="h-5 w-5" />
          </Link>
        )}
        {isModerator && (
          <Link
            href="/moderator"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-surface-2 hover:text-neutral-100"
            aria-label="Moderator dashboard"
          >
            <ShieldCheck className="h-5 w-5" />
          </Link>
        )}
        <NotificationBell />
        <AvatarLink initial={initial} avatarUrl={avatarUrl} name={session.user.name} />
      </>
    )
  }

  return (
    <Link href="/login">
      <Button size="sm" variant="ghost" className="gap-2">
        <User className="h-4 w-4" />
        Sign in
      </Button>
    </Link>
  )
}
