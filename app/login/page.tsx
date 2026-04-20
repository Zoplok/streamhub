'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function LoginPage() {
  const router = useRouter()
  const params = useSearchParams()
  const callbackUrl = params.get('callbackUrl') ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await signIn('credentials', { email, password, redirect: false })
    setLoading(false)
    if (res?.error) setError('Invalid credentials')
    else router.push(callbackUrl)
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-surface-3 bg-surface-1 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-surface-0 shadow-glow">
            <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current"><path d="M8 5v14l11-7z" /></svg>
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Welcome back</h1>
            <p className="text-xs text-neutral-400">Sign in to continue to StreamHub</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <Input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {error && (
            <p className="rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-neutral-400">
          No account?{' '}
          <Link href="/register" className="font-semibold text-brand-400 hover:text-brand-300">
            Create one
          </Link>
        </p>
      </div>
    </div>
  )
}
