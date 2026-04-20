'use client'

import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

interface Props {
  src: string
  poster?: string | null
  autoPlay?: boolean
}

export function VideoPlayer({ src, poster, autoPlay = false }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
      hls.loadSource(src)
      hls.attachMedia(video)
      return () => hls.destroy()
    }

    video.src = src
  }, [src])

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full rounded-lg bg-black"
      controls
      playsInline
      autoPlay={autoPlay}
      poster={poster ?? undefined}
    />
  )
}
