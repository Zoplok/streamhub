'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function RegisterPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'viewer' | 'creator'>('viewer')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password, role })
    })
    const json = await res.json()
    if (!res.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Registration failed')
      setLoading(false)
      return
    }
    await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    router.push('/')
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-surface-3 bg-surface-1 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-surface-0 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Join StreamHub</h1>
            <p className="text-xs text-neutral-400">Start watching, streaming, creating</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={3} />
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password (min 8)" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label
              className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors ${
                role === 'viewer'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                  : 'border-surface-3 bg-surface-2 text-neutral-300 hover:bg-surface-3'
              }`}
            >
              <input type="radio" className="sr-only" checked={role === 'viewer'} onChange={() => setRole('viewer')} />
              <span className="font-semibold">Viewer</span>
              <span className="mt-0.5 text-xs text-neutral-500">Watch & chat</span>
            </label>
            <label
              className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors ${
                role === 'creator'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                  : 'border-surface-3 bg-surface-2 text-neutral-300 hover:bg-surface-3'
              }`}
            >
              <input type="radio" className="sr-only" checked={role === 'creator'} onChange={() => setRole('creator')} />
              <span className="font-semibold">Creator</span>
              <span className="mt-0.5 text-xs text-neutral-500">Upload & stream</span>
            </label>
          </div>
          {error && (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Creating…' : 'Create account'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-neutral-400">
          Have an account?{' '}
          <Link href="/login" className="font-semibold text-brand-400 hover:text-brand-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
