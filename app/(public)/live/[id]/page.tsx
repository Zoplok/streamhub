import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { LivePlayer } from '@/components/live/LivePlayer'
import { ChatSidebar } from '@/components/live/ChatSidebar'
import { ViewerCount } from '@/components/live/ViewerCount'

interface StreamRow {
  id: string
  title: string
  status: 'idle' | 'live' | 'ended'
  viewer_count: number
  hls_url: string | null
  channel_id: string
  channel_name: string
}

export default async function LiveDetailPage({ params }: { params: { id: string } }) {
  const [streamRes, session] = await Promise.all([
    db.query<StreamRow>(
      `SELECT ls.id, ls.title, ls.status, ls.viewer_count, ls.hls_url,
              ls.channel_id, c.name AS channel_name
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=?`,
      [params.id]
    ),
    auth()
  ])
  const stream = streamRes.rows[0]
  if (!stream) notFound()

  return (
    <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1fr_360px] lg:h-[calc(100vh-3.5rem)]">
      <div className="p-4">
        {stream.hls_url && stream.status === 'live' ? (
          <LivePlayer src={stream.hls_url} />
        ) : (
          <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-neutral-900 text-neutral-500">
            {stream.status === 'ended' ? 'Stream ended' : 'Stream offline'}
          </div>
        )}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{stream.title}</h1>
            <p className="text-sm text-neutral-400">{stream.channel_name}</p>
          </div>
          <ViewerCount count={stream.viewer_count} live={stream.status === 'live'} />
        </div>
      </div>
      <ChatSidebar
        streamId={stream.id}
        userId={session?.user?.id ?? null}
        username={session?.user?.name ?? null}
      />
    </div>
  )
}
