import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { StudioClient } from '@/components/studio/StudioClient'

interface StreamRow {
  id: string
  title: string
  status: string
  stream_key: string
  channel_id: string
  channel_name: string
  user_id: string
}

export default async function StudioPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect(`/login?callbackUrl=/studio/${params.id}`)

  const result = await db.query<StreamRow>(
    `SELECT ls.id, ls.title, ls.status, ls.stream_key, ls.channel_id,
            c.name AS channel_name, c.user_id
     FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
     WHERE ls.id = ? LIMIT 1`,
    [params.id]
  )
  const stream = result.rows[0]
  if (!stream) notFound()

  if (stream.user_id !== session.user.id && session.user.role !== 'admin') {
    redirect('/403')
  }

  return (
    <StudioClient
      streamId={stream.id}
      streamKey={stream.stream_key}
      title={stream.title}
      channelName={stream.channel_name}
      initialStatus={stream.status}
      userId={session.user.id ?? null}
      username={session.user.name ?? null}
    />
  )
}
