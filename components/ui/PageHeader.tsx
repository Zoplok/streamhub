import type { ComponentType, ReactNode } from 'react'

interface Props {
  icon?: ComponentType<{ className?: string }>
  eyebrow?: string
  title: string
  subtitle?: string
  accent?: 'brand' | 'red' | 'amber' | 'blue' | 'violet'
  actions?: ReactNode
}

const accents = {
  brand: 'bg-brand-500 text-surface-0 shadow-glow',
  red: 'bg-red-600 text-white shadow-[0_4px_20px_-4px_rgba(239,68,68,0.45)]',
  amber: 'bg-amber-500 text-surface-0 shadow-[0_4px_20px_-4px_rgba(245,158,11,0.45)]',
  blue: 'bg-sky-500 text-surface-0 shadow-[0_4px_20px_-4px_rgba(14,165,233,0.45)]',
  violet: 'bg-violet-500 text-white shadow-[0_4px_20px_-4px_rgba(139,92,246,0.45)]'
} as const

export function PageHeader({ icon: Icon, eyebrow, title, subtitle, accent = 'brand', actions }: Props) {
  return (
    <div className="mb-6 flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${accents[accent]}`}>
            <Icon className="h-6 w-6" />
          </div>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">{eyebrow}</p>
          )}
          <h1 className="break-words text-2xl font-extrabold tracking-tight md:text-3xl">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-neutral-400">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex w-full flex-wrap items-center gap-2 md:w-auto md:shrink-0">{actions}</div>}
    </div>
  )
}
