import { ReportTable } from '@/components/admin/ReportTable'

export default function AdminReportsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Reports</h1>
      <ReportTable />
    </div>
  )
}
