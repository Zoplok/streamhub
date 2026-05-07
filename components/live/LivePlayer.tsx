'use client'

import { useEffect, useRef } from 'react'

export function LivePlayer({ src }: { src: string }) {
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
        const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 3 })
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
      className="h-full w-full bg-black object-contain"
      controls
      preload="metadata"
      autoPlay
      muted
      playsInline
    />
  )
}
