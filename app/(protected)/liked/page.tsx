import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { VideoGrid } from '@/components/video/VideoGrid'
import { PageHeader } from '@/components/ui/PageHeader'
import { ThumbsUp } from 'lucide-react'

export const dynamic = 'force-dynamic'
export default async function LikedPage() {
  const session = await auth()
  if (!session?.user) redirect('/login?callbackUrl=/liked')

  const res = await db.query<{
    id: string
    title: string
    thumbnail_url: string | null
    duration: number
    views: number
    created_at: string
    channel_name: string
  }>(
    `SELECT v.id, v.title, v.thumbnail_url, v.duration, v.views, v.created_at,
            c.name AS channel_name
     FROM reactions r
     JOIN videos v ON v.id = r.target_id
     JOIN channels c ON c.id = v.channel_id
     WHERE r.user_id = ? AND r.target_type = 'video' AND r.type = 'like'
     ORDER BY r.created_at DESC
     LIMIT 60`,
    [session.user.id]
  )

  return (
    <div className="px-4 py-6 md:px-6 lg:px-8">
      <PageHeader
        icon={ThumbsUp}
        eyebrow="Saved"
        title="Liked videos"
        subtitle="Everything you've given a thumbs up."
        accent="amber"
      />
      {res.rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-3 bg-surface-1 py-20 text-center">
          <div className="mb-3 text-4xl">👍</div>
          <p className="text-sm font-medium text-neutral-300">No likes yet</p>
          <p className="mt-1 text-xs text-neutral-500">Like a video and it will show up here.</p>
        </div>
      ) : (
        <VideoGrid videos={res.rows} />
      )}
    </div>
  )
}
