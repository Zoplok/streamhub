'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'
import { LivePlayer } from './LivePlayer'
import { WebRtcLivePlayer } from './WebRtcLivePlayer'

interface StreamState {
  status: 'idle' | 'live' | 'ended'
  hls_url: string | null
}

export function LiveStreamPlayer({
  streamId,
  initialStatus,
  initialHlsUrl
}: {
  streamId: string
  initialStatus: 'idle' | 'live' | 'ended'
  initialHlsUrl: string | null
}) {
  const [state, setState] = useState<StreamState>({
    status: initialStatus,
    hls_url: initialHlsUrl
  })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/streams/${streamId}`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json() as { data?: StreamState }
      if (json.data) setState({ status: json.data.status, hls_url: json.data.hls_url })
    } catch { /* ignore */ }
  }, [streamId])

  useEffect(() => {
    if (state.status === 'live' && state.hls_url) {
      if (timerRef.current) clearInterval(timerRef.current)
      return
    }
    timerRef.current = setInterval(poll, 5_000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [poll, state.status, state.hls_url])

  if (state.status === 'live' && state.hls_url) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-xl bg-black">
        <LivePlayer src={state.hls_url} />
      </div>
    )
  }

  if (state.status === 'live') {
    return <WebRtcLivePlayer streamId={streamId} />
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl bg-neutral-900">
      <div className="flex flex-col items-center gap-3 text-neutral-500">
        <Radio className="h-8 w-8 animate-pulse" />
        <p className="text-sm font-medium">
          {state.status === 'ended' ? 'Stream has ended' : 'Stream is offline'}
        </p>
        {state.status === 'idle' && (
          <p className="text-xs text-neutral-600">Page will update automatically when the streamer goes live</p>
        )}
      </div>
    </div>
  )
}
