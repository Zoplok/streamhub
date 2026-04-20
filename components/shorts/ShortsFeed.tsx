'use client'

import { ShortsPlayer } from './ShortsPlayer'
import type { Short } from '@/types'

export function ShortsFeed({ initial, initialCursor }: { initial: Short[]; initialCursor: string | null }) {
  async function loadMore(cursor: string | null) {
    const url = cursor ? `/api/shorts/feed?cursor=${encodeURIComponent(cursor)}&limit=10` : `/api/shorts/feed?limit=10`
    const res = await fetch(url)
    const json = await res.json()
    return { data: json.data ?? [], nextCursor: json.nextCursor ?? null }
  }
  return <ShortsPlayer initial={initial} loadMore={loadMore} initialCursor={initialCursor} />
}
