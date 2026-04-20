'use client'

import { useEffect } from 'react'

/**
 * Tiny client-only tracker that records a watch-history entry.
 * Fires once shortly after mount (so very brief hits don't spam history)
 * and again every 30s while the tab is visible, sending current progress.
 */
export function WatchTracker({ videoId }: { videoId: string }) {
  useEffect(() => {
    let cancelled = false
    let startedAt = Date.now()

    const send = async (progress: number) => {
      if (cancelled) return
      try {
        await fetch('/api/watch-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ video_id: videoId, progress_seconds: progress }),
          keepalive: true
        })
      } catch {
        /* ignore — not fatal */
      }
    }

    const initial = setTimeout(() => {
      void send(0)
      startedAt = Date.now()
    }, 5_000) // 5s watched → count as a view

    const iv = setInterval(() => {
      if (document.hidden) return
      const progress = Math.floor((Date.now() - startedAt) / 1000)
      void send(progress)
    }, 30_000)

    const onUnload = () => {
      const progress = Math.floor((Date.now() - startedAt) / 1000)
      if (progress > 5) void send(progress)
    }
    window.addEventListener('pagehide', onUnload)

    return () => {
      cancelled = true
      clearTimeout(initial)
      clearInterval(iv)
      window.removeEventListener('pagehide', onUnload)
    }
  }, [videoId])

  return null
}
