import { db } from '@/lib/db'
import { Badge } from '@/components/ui/Badge'
import { LiveCard } from '@/components/live/LiveCard'

export const dynamic = 'force-dynamic'
export const revalidate = 10

interface LiveRow {
  id: string
  title: string
  channel_name: string
  viewer_count: number
  thumbnail_url: string | null
  category: string | null
  started_at: string | null
}

export default async function LiveIndexPage() {
  const result = await db.query<LiveRow>(
    `SELECT ls.id, ls.title, ls.viewer_count, ls.thumbnail_url, ls.category, ls.started_at, c.name AS channel_name
     FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
     WHERE ls.status='live'
     ORDER BY ls.viewer_count DESC`
  )
  return (
    <div className="mx-auto max-w-7xl px-3 py-4 sm:px-4 sm:py-6">
      <div className="mb-4 flex items-center gap-2">
        <Badge tone="live">LIVE</Badge>
        <h1 className="text-2xl font-bold">Live now</h1>
      </div>
      {result.rows.length === 0 ? (
        <p className="text-neutral-500">No one is streaming right now.</p>
      ) : (
        <ul className="grid auto-rows-fr grid-cols-[repeat(auto-fit,minmax(min(100%,18rem),1fr))] gap-4">
          {result.rows.map((s) => (
            <li key={s.id} className="h-full">
              <LiveCard
                id={s.id}
                title={s.title}
                channel_name={s.channel_name}
                viewer_count={s.viewer_count}
                thumbnail_url={s.thumbnail_url}
                category={s.category}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
