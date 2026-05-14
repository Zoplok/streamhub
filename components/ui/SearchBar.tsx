'use client'

import { Search } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function SearchBar() {
  const router = useRouter()
  const [q, setQ] = useState('')

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const query = q.trim()
        if (query) router.push(`/search?q=${encodeURIComponent(query)}`)
      }}
      className="flex w-full max-w-2xl items-center gap-2"
    >
      <div className="relative flex h-10 flex-1 items-center overflow-hidden rounded-full border border-surface-4 bg-surface-1 focus-within:border-brand-500 focus-within:shadow-glow">
        <Search className="ml-3 h-4 w-4 shrink-0 text-neutral-400 sm:ml-4" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          type="text"
          placeholder="Search videos, streams, creators…"
          className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none sm:px-3"
        />
        <button
          type="submit"
          className="h-full shrink-0 border-l border-surface-4 bg-surface-2 px-3 text-neutral-300 transition-colors hover:bg-surface-3 hover:text-white sm:px-5"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
    </form>
  )
}
