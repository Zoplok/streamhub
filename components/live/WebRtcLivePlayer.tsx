'use client'

import { useEffect, useRef, useState } from 'react'
import { Radio } from 'lucide-react'

interface SignalRow {
  payload: string
}

function makeViewerId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function waitForIceGathering(pc: RTCPeerConnection) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return new Promise<void>((resolve) => {
    const done = () => {
      if (pc.iceGatheringState !== 'complete') return
      pc.removeEventListener('icegatheringstatechange', done)
      resolve()
    }
    pc.addEventListener('icegatheringstatechange', done)
    window.setTimeout(() => {
      pc.removeEventListener('icegatheringstatechange', done)
      resolve()
    }, 2500)
  })
}

export function WebRtcLivePlayer({ streamId }: { streamId: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [status, setStatus] = useState('Connecting to browser live...')

  useEffect(() => {
    let cancelled = false
    const viewerId = makeViewerId()
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    })

    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })
    pc.ontrack = (event) => {
      if (!videoRef.current) return
      const [stream] = event.streams
      if (stream) {
        videoRef.current.srcObject = stream
        setStatus('Live')
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') setStatus('Could not connect to the Studio tab.')
      if (pc.connectionState === 'connected') setStatus('Live')
    }

    async function connect() {
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        await waitForIceGathering(pc)

        await fetch(`/api/streams/${streamId}/webrtc`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewerId,
            type: 'viewer-offer',
            payload: pc.localDescription
          })
        })

        const poll = window.setInterval(async () => {
          if (cancelled) return
          try {
            const res = await fetch(`/api/streams/${streamId}/webrtc?role=viewer&viewerId=${encodeURIComponent(viewerId)}`, {
              cache: 'no-store'
            })
            if (!res.ok) return
            const json = await res.json() as { data?: SignalRow[] }
            const answer = json.data?.[0]
            if (!answer || pc.remoteDescription) return
            await pc.setRemoteDescription(JSON.parse(answer.payload) as RTCSessionDescriptionInit)
            window.clearInterval(poll)
          } catch {
            /* retry */
          }
        }, 1200)
      } catch {
        if (!cancelled) setStatus('Browser live could not start.')
      }
    }

    void connect()
    return () => {
      cancelled = true
      pc.close()
    }
  }, [streamId])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black">
      <video ref={videoRef} className="h-full w-full bg-black object-contain" autoPlay playsInline controls />
      {status !== 'Live' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/75 text-center text-sm text-neutral-300">
          <Radio className="h-7 w-7 text-brand-400" />
          <span>{status}</span>
        </div>
      )}
    </div>
  )
}
