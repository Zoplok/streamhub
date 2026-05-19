import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { UserTable } from '@/components/admin/UserTable'

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/admin/users')
  if (session.user.role !== 'admin') redirect('/403')

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <UserTable />
    </div>
  )
}
