'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export function ReactionBar({
  videoId,
  initialLikes,
  initialDislikes
}: {
  videoId: string
  initialLikes: number
  initialDislikes: number
}) {
  const [likes, setLikes] = useState(initialLikes)
  const [dislikes, setDislikes] = useState(initialDislikes)
  const [picked, setPicked] = useState<'like' | 'dislike' | null>(null)
  const [loading, setLoading] = useState(false)

  async function react(type: 'like' | 'dislike') {
    if (loading) return
    setLoading(true)
    const prev = picked
    // optimistic
    if (type === 'like') {
      setLikes((n) => n + (picked === 'like' ? -1 : 1))
      if (picked === 'dislike') setDislikes((n) => n - 1)
      setPicked(picked === 'like' ? null : 'like')
    } else {
      setDislikes((n) => n + (picked === 'dislike' ? -1 : 1))
      if (picked === 'like') setLikes((n) => n - 1)
      setPicked(picked === 'dislike' ? null : 'dislike')
    }
    try {
      if (prev === type) {
        await fetch('/api/reactions', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_type: 'video', target_id: videoId })
        })
      } else {
        await fetch('/api/reactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_type: 'video', target_id: videoId, type })
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={picked === 'like' ? 'primary' : 'secondary'}
        size="sm"
        onClick={() => react('like')}
        disabled={loading}
      >
        👍 {likes}
      </Button>
      <Button
        variant={picked === 'dislike' ? 'danger' : 'secondary'}
        size="sm"
        onClick={() => react('dislike')}
        disabled={loading}
      >
        👎 {dislikes}
      </Button>
    </div>
  )
}
