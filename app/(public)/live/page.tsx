import Link from 'next/link'
import { db } from '@/lib/db'
import { Badge } from '@/components/ui/Badge'

export const revalidate = 10

interface LiveRow {
  id: string
  title: string
  channel_name: string
  viewer_count: number
  started_at: string | null
}

export default async function LiveIndexPage() {
  const result = await db.query<LiveRow>(
    `SELECT ls.id, ls.title, ls.viewer_count, ls.started_at, c.name AS channel_name
     FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
     WHERE ls.status='live'
     ORDER BY ls.viewer_count DESC`
  )
  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Badge tone="live">LIVE</Badge>
        <h1 className="text-2xl font-bold">Live now</h1>
      </div>
      {result.rows.length === 0 ? (
        <p className="text-neutral-500">No one is streaming right now.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.rows.map((s) => (
            <li key={s.id}>
              <Link
                href={`/live/${s.id}`}
                className="block rounded-lg border border-neutral-800 bg-neutral-900 p-4 hover:border-brand-500"
              >
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-neutral-400">{s.channel_name}</p>
                <p className="mt-2 text-xs text-neutral-500">{s.viewer_count.toLocaleString()} watching</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
