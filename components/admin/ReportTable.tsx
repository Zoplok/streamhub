'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

interface Report {
  id: string
  target_type: string
  target_id: string
  reason: string
  status: string
  created_at: string
  reporter_username: string
}

export function ReportTable() {
  const [rows, setRows] = useState<Report[]>([])
  const [filter, setFilter] = useState<'pending' | 'resolved' | 'dismissed' | 'all'>('pending')
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    const url = filter === 'all' ? '/api/admin/reports' : `/api/admin/reports?status=${filter}`
    const res = await fetch(url)
    const json = await res.json()
    setRows(json.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void load()
  }, [filter])

  async function update(id: string, status: 'resolved' | 'dismissed') {
    await fetch('/api/admin/reports', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    })
    await load()
  }

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(['pending', 'resolved', 'dismissed', 'all'] as const).map((f) => (
          <Button key={f} size="sm" variant={filter === f ? 'primary' : 'secondary'} onClick={() => setFilter(f)}>
            {f}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full text-sm">
          <thead className="bg-neutral-900 text-left">
            <tr>
              <th className="px-3 py-2">Reporter</th>
              <th className="px-3 py-2">Target</th>
              <th className="px-3 py-2">Reason</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Created</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-neutral-500">Loading…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center text-neutral-500">No reports</td></tr>
            )}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-800">
                <td className="px-3 py-2">{r.reporter_username}</td>
                <td className="px-3 py-2">{r.target_type}</td>
                <td className="px-3 py-2 max-w-xs truncate">{r.reason}</td>
                <td className="px-3 py-2">{r.status}</td>
                <td className="px-3 py-2 text-neutral-400">{new Date(r.created_at).toLocaleString()}</td>
                <td className="px-3 py-2">
                  {r.status === 'pending' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="primary" onClick={() => update(r.id, 'resolved')}>Resolve</Button>
                      <Button size="sm" variant="ghost" onClick={() => update(r.id, 'dismissed')}>Dismiss</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
