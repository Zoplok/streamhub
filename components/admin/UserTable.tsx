'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface User {
  id: string
  username: string
  email: string
  role: 'admin' | 'moderator' | 'creator' | 'viewer'
  created_at: string
}

export function UserTable() {
  const [rows, setRows] = useState<User[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const url = q ? `/api/admin/users?q=${encodeURIComponent(q)}` : '/api/admin/users'
    const res = await fetch(url)
    const json = await res.json()
    setRows(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [])

  async function act(id: string, action: 'ban' | 'promote' | 'demote', role?: string) {
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, role })
    })
    await load()
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void load()
        }}
        className="mb-3 flex gap-2"
      >
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" />
        <Button type="submit">Search</Button>
      </form>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left">
            <tr>
              <th className="px-3 py-2">Username</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className="px-3 py-4 text-center text-neutral-500">Loading…</td></tr>
            )}
            {rows.map((u) => (
              <tr key={u.id} className="border-t border-neutral-800">
                <td className="px-3 py-2 font-medium">{u.username}</td>
                <td className="px-3 py-2 text-neutral-400">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2 text-neutral-400">{new Date(u.created_at).toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="secondary" onClick={() => act(u.id, 'promote', 'moderator')}>
                      Make Mod
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => act(u.id, 'promote', 'creator')}>
                      Make Creator
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => act(u.id, 'ban')}>
                      Ban
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
