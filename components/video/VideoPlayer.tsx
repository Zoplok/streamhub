'use client'

import { useEffect, useRef } from 'react'

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

    let disposed = false
    let cleanup: (() => void) | undefined
    void import('hls.js').then(({ default: Hls }) => {
      if (disposed || videoRef.current !== video) return
      if (Hls.isSupported()) {
        const hls = new Hls({ enableWorker: true, lowLatencyMode: false })
        hls.loadSource(src)
        hls.attachMedia(video)
        cleanup = () => hls.destroy()
        return
      }
      video.src = src
    })

    return () => {
      disposed = true
      cleanup?.()
    }
  }, [src])

  return (
    <video
      ref={videoRef}
      className="aspect-video w-full rounded-lg bg-black"
      controls
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      poster={poster ?? undefined}
    />
  )
}
