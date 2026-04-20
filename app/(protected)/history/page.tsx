import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { VideoGrid } from '@/components/video/VideoGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { History as HistoryIcon } from 'lucide-react'

export default async function HistoryPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/history')

  const res = await db.query<{
    id: string
    title: string
    thumbnail_url: string | null
    duration: number
    views: number
    created_at: string
    channel_name: string
    watched_at: string
  }>(
    `SELECT v.id, v.title, v.thumbnail_url, v.duration, v.views, v.created_at,
            c.name AS channel_name, wh.watched_at
     FROM watch_history wh
     JOIN videos v ON v.id = wh.video_id
     JOIN channels c ON c.id = v.channel_id
     WHERE wh.user_id = ?
     ORDER BY wh.watched_at DESC
     LIMIT 60`,
    [session.user.id]
  )

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        icon={HistoryIcon}
        eyebrow="Recently watched"
        title="Watch history"
        subtitle="Videos you've watched recently."
        accent="blue"
      />
      {res.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-3 bg-surface-1 py-20 text-center">
          <div className="mb-3 text-4xl">🕓</div>
          <p className="text-sm font-medium text-neutral-300">No history yet</p>
          <p className="mt-1 text-xs text-neutral-500">Videos you watch will appear here.</p>
        </div>
      ) : (
        <VideoGrid videos={res.rows} />
      )}
    </div>
  )
}
