'use client'

import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

export function LivePlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }
    if (Hls.isSupported()) {
      const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 })
      hls.loadSource(src)
      hls.attachMedia(video)
      return () => hls.destroy()
    }
    video.src = src
  }, [src])

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full bg-black"
      controls
      autoPlay
      muted
      playsInline
    />
  )
}
