import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { ChannelEditor } from '@/components/channel/ChannelEditor'

export const dynamic = 'force-dynamic'
export default async function CustomizeChannelPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/dashboard/channel')

  const res = await db.query<{
    id: string
    name: string
    description: string | null
    banner_url: string | null
    avatar_url: string | null
    category: string | null
  }>(
    'SELECT id, name, description, banner_url, avatar_url, category FROM channels WHERE user_id=? LIMIT 1',
    [session.user.id]
  )
  const channel = res.rows[0]

  if (!channel) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="rounded-xl border border-surface-3 bg-surface-1 p-8 text-center">
          <h1 className="text-xl font-bold">No channel found</h1>
          <p className="mt-2 text-sm text-neutral-400">
            You need a creator channel before you can customize it.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Creator Studio</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">Customize channel</h1>
          <p className="mt-1 text-sm text-neutral-400">Update how your channel appears across StreamHub.</p>
        </div>
        <ChannelEditor channel={channel} />
      </div>
    </div>
  )
}
