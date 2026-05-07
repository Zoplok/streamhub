import Link from 'next/link'
import { SubscribeButton } from './SubscribeButton'
import { Button } from '@/components/ui/Button'
import { Pencil } from 'lucide-react'

interface Props {
  channelId: string
  name: string
  description: string | null
  banner_url: string | null
  avatar_url?: string | null
  category?: string | null
  owner_username: string
  subscribers: number
  videosCount?: number
  isOwner?: boolean
}

export function ChannelHeader(props: Props) {
  const initial = props.name[0]?.toUpperCase() ?? '?'
  return (
    <div>
      {/* Banner */}
      <div
        className="relative z-0 h-40 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-500 to-brand-300 md:h-56"
        style={
          props.banner_url
            ? { backgroundImage: `url(${props.banner_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
            : undefined
        }
      >
        <div className="absolute inset-0 bg-gradient-to-t from-surface-0/70 via-transparent to-transparent" />
      </div>

      {/* Profile row */}
      <div className="relative z-10 -mt-10 flex flex-col gap-4 px-2 md:-mt-14 md:flex-row md:items-end md:gap-6">
        <div
          className="relative z-10 flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-3xl font-extrabold text-surface-0 ring-4 ring-surface-0 md:h-32 md:w-32 md:text-4xl"
          style={
            props.avatar_url
              ? { backgroundImage: `url(${props.avatar_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : undefined
          }
        >
          {!props.avatar_url && initial}
        </div>

        <div className="min-w-0 flex-1 pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold tracking-tight md:text-3xl">{props.name}</h1>
            {props.category && (
              <span className="rounded-md bg-surface-3 px-2 py-0.5 text-xs font-semibold text-neutral-300">
                {props.category}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-400">
            <span className="font-medium text-neutral-300">@{props.owner_username}</span>
            <span className="mx-1.5">·</span>
            <span>{props.subscribers.toLocaleString()} subscribers</span>
            {typeof props.videosCount === 'number' && (
              <>
                <span className="mx-1.5">·</span>
                <span>{props.videosCount.toLocaleString()} videos</span>
              </>
            )}
          </p>
          {props.description && (
            <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-neutral-300">{props.description}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 pb-2">
          {props.isOwner ? (
            <Link href="/dashboard/channel">
              <Button variant="secondary" size="md" className="gap-2">
                <Pencil className="h-4 w-4" />
                Customize
              </Button>
            </Link>
          ) : (
            <SubscribeButton channelId={props.channelId} />
          )}
        </div>
      </div>
    </div>
  )
}
