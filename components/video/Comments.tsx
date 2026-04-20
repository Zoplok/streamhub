'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { Comment } from '@/types'

export function Comments({ videoId }: { videoId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    const res = await fetch(`/api/videos/${videoId}/comments`)
    const json = await res.json()
    if (json.data) setComments(json.data)
  }

  useEffect(() => {
    void load()
  }, [videoId])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/videos/${videoId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: text })
      })
      if (res.ok) {
        setText('')
        await load()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <section className="mt-6">
      <h3 className="mb-3 text-lg font-semibold">Comments</h3>
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a comment..."
          maxLength={2000}
        />
        <Button type="submit" disabled={loading || !text.trim()}>
          Post
        </Button>
      </form>
      <ul className="space-y-4">
        {comments.map((c) => (
          <CommentItem key={c.id} comment={c} />
        ))}
      </ul>
    </section>
  )
}

function CommentItem({ comment }: { comment: Comment }) {
  return (
    <li className="flex gap-3">
      <div className="h-9 w-9 flex-shrink-0 rounded-full bg-neutral-800" />
      <div className="flex-1">
        <p className="text-sm font-medium">
          {comment.username} <span className="ml-2 text-xs text-neutral-500">{new Date(comment.created_at).toLocaleDateString()}</span>
        </p>
        <p className="mt-0.5 text-sm text-neutral-300">{comment.content}</p>
        {comment.replies && comment.replies.length > 0 && (
          <ul className="mt-3 space-y-3 border-l border-neutral-800 pl-4">
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} />
            ))}
          </ul>
        )}
      </div>
    </li>
  )
}
