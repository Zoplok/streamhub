import type { ReactNode } from 'react'

type Tone = 'default' | 'live' | 'success' | 'warning' | 'danger' | 'brand'

const tones: Record<Tone, string> = {
  default: 'bg-surface-3 text-neutral-200',
  live: 'bg-red-600 text-white animate-live-pulse',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-surface-0',
  danger: 'bg-red-600 text-white',
  brand: 'bg-brand-500 text-surface-0'
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${tones[tone]}`}>
      {tone === 'live' && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
      {children}
    </span>
  )
}
