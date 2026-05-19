export const clerkAuthAppearance = {
  options: {
    // Keep development UI visually close to production for local design review.
    unsafe_disableDevelopmentModeWarnings: true
  },
  layout: {
    socialButtonsVariant: 'blockButton' as const
  },
  variables: {
    colorPrimary: '#53fc18',
    colorTextOnPrimaryBackground: '#0b1306',
    borderRadius: '0.9rem',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif'
  },
  elements: {
    rootBox: 'w-full',
    cardBox:
      'w-full overflow-hidden rounded-2xl border border-surface-3 bg-surface-1 text-fg shadow-2xl ring-1 ring-black/5',
    card:
      'w-full rounded-none border-0 bg-transparent text-fg shadow-none ring-0',
    headerTitle: 'text-2xl font-extrabold tracking-tight text-fg',
    headerSubtitle: 'mt-1 text-xs text-neutral-400',
    socialButtonsBlockButton:
      'h-11 rounded-xl border border-surface-3 bg-surface-0 text-fg transition-colors hover:border-surface-4 hover:bg-surface-2',
    socialButtonsBlockButtonText: 'text-sm font-semibold text-fg',
    dividerLine: 'bg-surface-3',
    dividerText: 'text-[11px] uppercase tracking-wide text-neutral-500',
    formFieldLabel: 'text-sm font-medium text-neutral-300',
    formFieldInput:
      'h-11 rounded-xl border border-surface-3 bg-surface-0 text-fg placeholder:text-neutral-500 transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/40',
    formFieldInputShowPasswordButton:
      'text-neutral-400 transition-colors hover:text-neutral-200 focus:text-neutral-100',
    formButtonPrimary:
      'h-11 rounded-xl bg-brand-500 text-surface-0 font-semibold transition-colors hover:bg-brand-400 focus:ring-2 focus:ring-brand-500/50 shadow-[0_4px_16px_-4px_rgba(83,252,24,0.45)]',
    footer: 'border-t border-surface-3 bg-surface-1',
    footerActionText: 'text-sm text-neutral-400',
    footerActionLink: 'font-semibold text-brand-400 transition-colors hover:text-brand-300',
    footerItem: 'text-neutral-400',
    formResendCodeLink: 'font-semibold text-brand-400 transition-colors hover:text-brand-300'
  }
}
