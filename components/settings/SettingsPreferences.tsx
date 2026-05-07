'use client'

import { useState, useEffect } from 'react'
import { Bell } from 'lucide-react'

const PREFS_KEY = 'streamhub-prefs'

const PREF_ITEMS = [
  { key: 'email_subscribers', label: 'Email me about new subscribers', defaultVal: true },
  { key: 'email_mentions', label: 'Email me about comments and mentions', defaultVal: true },
  { key: 'autoplay', label: 'Autoplay next video', defaultVal: true },
  { key: 'mature_content', label: 'Show mature content', defaultVal: false },
]

type PrefsMap = Record<string, boolean>

export function SettingsPreferences() {
  const [prefs, setPrefs] = useState<PrefsMap>(() => {
    const defaults: PrefsMap = {}
    PREF_ITEMS.forEach(p => { defaults[p.key] = p.defaultVal })
    return defaults
  })
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PREFS_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as PrefsMap
        setPrefs(prev => ({ ...prev, ...parsed }))
      }
    } catch { /* ignore */ }
    setLoaded(true)
  }, [])

  function toggle(key: string) {
    setPrefs(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem(PREFS_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  return (
    <section className="mb-6 rounded-2xl border border-surface-3 bg-surface-1 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Bell className="h-4 w-4 text-brand-400" />
        <h2 className="text-base font-bold">Preferences</h2>
      </div>
      <div className="divide-y divide-surface-3">
        {PREF_ITEMS.map(p => (
          <div key={p.key} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
            <span className="text-sm text-neutral-200">{p.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={prefs[p.key]}
              onClick={() => toggle(p.key)}
              disabled={!loaded}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 disabled:cursor-not-allowed ${
                prefs[p.key] ? 'bg-brand-500' : 'bg-surface-4'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                  prefs[p.key] ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
