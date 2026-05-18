import { notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import { LiveStreamPlayer } from '@/components/live/LiveStreamPlayer'
import { ChatSidebar } from '@/components/live/ChatSidebar'
import { ViewerCount } from '@/components/live/ViewerCount'
import { StreamLikeButton } from '@/components/live/StreamLikeButton'
import { SubscribeButton } from '@/components/channel/SubscribeButton'

interface StreamRow {
  id: string
  title: string
  status: 'idle' | 'live' | 'ended'
  viewer_count: number
  hls_url: string | null
  channel_id: string
  channel_name: string
  channel_owner_id: string
}

type SearchParams = { [key: string]: string | string[] | undefined }

function pickQueryValue(value: string | string[] | undefined) {
  return typeof value === 'string' ? value : null
}

export default async function LiveDetailPage({
  params,
  searchParams
}: {
  params: { id: string }
  searchParams?: SearchParams
}) {
  const [streamRes, session] = await Promise.all([
    db.query<StreamRow>(
      `SELECT ls.id, ls.title, ls.status, ls.viewer_count, ls.hls_url,
              ls.channel_id, c.name AS channel_name, c.user_id AS channel_owner_id
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=?`,
      [params.id]
    ),
    auth()
  ])
  const stream = streamRes.rows[0]
  if (!stream) notFound()

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden">
      <div className="flex min-h-0 flex-col gap-0 overflow-y-auto p-4 lg:p-5">
        <LiveStreamPlayer
          streamId={stream.id}
          initialStatus={stream.status}
          initialHlsUrl={stream.hls_url}
        />
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">{stream.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="text-sm text-neutral-400">{stream.channel_name}</p>
              {session?.user?.id && session.user.id !== stream.channel_owner_id && (
                <SubscribeButton channelId={stream.channel_id} />
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StreamLikeButton streamId={stream.id} />
            <ViewerCount count={stream.viewer_count} live={stream.status === 'live'} />
          </div>
        </div>
      </div>
      <ChatSidebar
        streamId={stream.id}
        userId={session?.user?.id ?? null}
        username={session?.user?.name ?? null}
        channelOwnerId={stream.channel_owner_id}
        superchatStatus={pickQueryValue(searchParams?.superchat)}
        superchatSessionId={pickQueryValue(searchParams?.sid)}
        superchatId={pickQueryValue(searchParams?.sc)}
      />
    </div>
  )
}
