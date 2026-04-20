import { VideoCard } from './VideoCard'

interface Video {
  id: string
  title: string
  thumbnail_url: string | null
  duration?: number
  views?: number
  channel_name?: string
  created_at?: string
}

export function VideoGrid({ videos }: { videos: Video[] }) {
  if (!videos.length) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-3 bg-surface-1 py-20 text-center">
        <div className="mb-3 text-4xl">📼</div>
        <p className="text-sm font-medium text-neutral-300">No videos yet</p>
        <p className="mt-1 text-xs text-neutral-500">Check back soon for fresh uploads.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {videos.map((v) => (
        <VideoCard key={v.id} {...v} />
      ))}
    </div>
  )
}
