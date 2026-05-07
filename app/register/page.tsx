'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { AlertCircle, Eye, Lock, Mail, Play, User, UserPlus, Video } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function RegisterPage() {
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
    window.location.assign('/')
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-md flex-col justify-center px-4 py-12">
      <div className="rounded-2xl border border-surface-3 bg-surface-1 p-8 shadow-2xl">
        <div className="mb-6 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-500 text-surface-0 shadow-glow">
            <Play className="h-5 w-5 fill-current" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Join StreamHub</h1>
            <p className="text-xs text-neutral-400">Start watching, streaming, creating</p>
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="relative">
            <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="pl-10"
              required
              minLength={3}
            />
          </div>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              type="password"
              placeholder="Password (min 8)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
              minLength={8}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label
              className={`flex cursor-pointer flex-col rounded-lg border p-3 text-sm transition-colors ${
                role === 'viewer'
                  ? 'border-brand-500 bg-brand-500/10 text-brand-300'
                  : 'border-surface-3 bg-surface-2 text-neutral-300 hover:bg-surface-3'
              }`}
            >
              <input type="radio" className="sr-only" checked={role === 'viewer'} onChange={() => setRole('viewer')} />
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface-0 text-neutral-300">
                <Eye className="h-4 w-4" />
              </span>
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
              <span className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-surface-0 text-neutral-300">
                <Video className="h-4 w-4" />
              </span>
              <span className="font-semibold">Creator</span>
              <span className="mt-0.5 text-xs text-neutral-500">Upload & stream</span>
            </label>
          </div>
          {error && (
            <p className="flex items-center gap-2 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" size="lg" disabled={loading}>
            {!loading && <UserPlus className="h-4 w-4" />}
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
