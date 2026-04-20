import { UserTable } from '@/components/admin/UserTable'

export default function AdminUsersPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Users</h1>
      <UserTable />
    </div>
  )
}
