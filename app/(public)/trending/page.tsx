import { cachedDbQuery } from '@/lib/cached-db'
import { VideoGrid } from '@/components/video/VideoGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { Flame } from 'lucide-react'

export const revalidate = 60

interface VideoRow {
  id: string
  title: string
  thumbnail_url: string | null
  duration: number
  views: number
  channel_name: string
  created_at: string
}

export default async function TrendingPage() {
  const vids = await cachedDbQuery<VideoRow>(
    'trending:videos',
    `SELECT v.id, v.title, v.thumbnail_url, v.duration, v.views, v.created_at,
            c.name AS channel_name
     FROM videos v JOIN channels c ON c.id = v.channel_id
     WHERE v.status='ready' AND v.created_at >= DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 30 DAY)
     ORDER BY v.views DESC
     LIMIT 48`,
    [],
    60
  )

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        icon={Flame}
        eyebrow="Last 30 days"
        title="Trending"
        subtitle="What everyone is watching right now."
        accent="red"
      />
      <VideoGrid videos={vids.rows} />
    </div>
  )
}
