'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'

export function StreamLikeButton({ streamId }: { streamId: string }) {
  const [liked, setLiked] = useState(false)
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/streams/${streamId}/like`)
      .then(r => r.json())
      .then((j: { data?: { liked: boolean; count: number } }) => {
        if (j.data) {
          setLiked(j.data.liked)
          setCount(j.data.count)
        }
      })
      .catch(() => {})
  }, [streamId])

  async function toggle() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/streams/${streamId}/like`, { method: 'POST' })
      const j = await res.json() as { data?: { liked: boolean; count: number } }
      if (j.data) {
        setLiked(j.data.liked)
        setCount(j.data.count)
      }
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed ${
        liked
          ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
          : 'bg-surface-2 text-neutral-400 hover:bg-surface-3 hover:text-neutral-200'
      }`}
      title={liked ? 'Unlike stream' : 'Like stream'}
    >
      <Heart className={`h-4 w-4 transition-all ${liked ? 'fill-red-400 text-red-400' : ''}`} />
      {count > 0 && <span className="tabular-nums">{count.toLocaleString()}</span>}
    </button>
  )
}
