import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ReportTable } from '@/components/admin/ReportTable'
import { ShieldCheck } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function ModeratorPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/moderator')
  if (!['admin', 'moderator'].includes(session.user.role)) redirect('/403')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-surface-0 shadow-glow">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-400">Moderator</p>
          <h1 className="text-2xl font-bold">Moderation queue</h1>
        </div>
      </div>
      <ReportTable />
    </div>
  )
}
