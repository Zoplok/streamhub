'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

export function SubscribeButton({ channelId }: { channelId: string }) {
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    fetch(`/api/channels/${channelId}/subscribe`)
      .then((r) => r.json())
      .then((j) => alive && setSubscribed(!!j.data?.subscribed))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [channelId])

  async function toggle() {
    if (loading) return
    setLoading(true)
    const next = !subscribed
    setSubscribed(next) // optimistic
    try {
      const res = await fetch(`/api/channels/${channelId}/subscribe`, {
        method: next ? 'POST' : 'DELETE'
      })
      if (!res.ok) setSubscribed(!next)
    } catch {
      setSubscribed(!next)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant={subscribed ? 'secondary' : 'primary'} onClick={toggle} disabled={loading}>
      {subscribed ? 'Subscribed' : 'Subscribe'}
    </Button>
  )
}
