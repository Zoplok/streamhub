import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { UserTable } from '@/components/admin/UserTable'

export default async function DashboardModeratorsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (!['admin', 'creator'].includes(session.user.role)) redirect('/403')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Creator Studio</p>
        <h1 className="mt-1 text-2xl font-bold">Viewer moderators</h1>
        <p className="mt-2 max-w-2xl text-sm text-neutral-400">
          Promote eligible channel viewers to moderator. Creators can promote viewer or creator accounts that have subscribed,
          chatted in a stream, or commented on one of their videos.
        </p>
      </div>
      <UserTable mode={session.user.role === 'admin' ? 'admin' : 'creator'} />
    </div>
  )
}
