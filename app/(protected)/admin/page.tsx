import Link from 'next/link'
import { db } from '@/lib/db'
import { StatsCard } from '@/components/admin/StatsCard'

export default async function AdminPage() {
  const [users, videos, streams, shorts, reports, views] = await Promise.all([
    db.query<{ c: number }>('SELECT CAST(COUNT(*) AS SIGNED) AS c FROM users'),
    db.query<{ c: number }>('SELECT CAST(COUNT(*) AS SIGNED) AS c FROM videos'),
    db.query<{ c: number }>("SELECT CAST(COUNT(*) AS SIGNED) AS c FROM live_streams WHERE status='live'"),
    db.query<{ c: number }>('SELECT CAST(COUNT(*) AS SIGNED) AS c FROM shorts'),
    db.query<{ c: number }>("SELECT CAST(COUNT(*) AS SIGNED) AS c FROM reports WHERE status='pending'"),
    db.query<{ s: number }>('SELECT CAST(COALESCE(SUM(views),0) AS SIGNED) AS s FROM videos')
  ])

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="mb-6 text-2xl font-bold">Admin dashboard</h1>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatsCard label="Users" value={users.rows[0].c} />
        <StatsCard label="Videos" value={videos.rows[0].c} />
        <StatsCard label="Live streams" value={streams.rows[0].c} />
        <StatsCard label="Shorts" value={shorts.rows[0].c} />
        <StatsCard label="Pending reports" value={reports.rows[0].c} />
        <StatsCard label="Total views" value={views.rows[0].s} />
      </div>
      <div className="mt-8 flex gap-4">
        <Link href="/admin/reports" className="rounded-md bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
          Reports
        </Link>
        <Link href="/admin/users" className="rounded-md bg-neutral-800 px-4 py-2 text-sm hover:bg-neutral-700">
          Users
        </Link>
      </div>
    </div>
  )
}
