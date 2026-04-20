import type { ComponentType } from 'react'

interface Props {
  label: string
  value: number | string
  icon?: ComponentType<{ className?: string }>
  accent?: 'brand' | 'red' | 'blue' | 'amber'
  delta?: string
}

const accents = {
  brand: 'text-brand-400 bg-brand-500/10 ring-brand-500/30',
  red: 'text-red-400 bg-red-500/10 ring-red-500/30',
  blue: 'text-sky-400 bg-sky-500/10 ring-sky-500/30',
  amber: 'text-amber-400 bg-amber-500/10 ring-amber-500/30'
} as const

export function StatsCard({ label, value, icon: Icon, accent = 'brand', delta }: Props) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-surface-3 bg-surface-1 p-5 transition-colors hover:border-surface-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-white tabular-nums">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
          {delta && (
            <div className="mt-1 text-xs font-medium text-neutral-400">{delta}</div>
          )}
        </div>
        {Icon && (
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ${accents[accent]}`}>
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  )
}
