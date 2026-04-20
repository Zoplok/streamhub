import { InputHTMLAttributes, forwardRef } from 'react'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className = '', ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`h-11 w-full rounded-lg border border-surface-3 bg-surface-1 px-4 text-sm text-neutral-100 placeholder-neutral-500 transition-colors focus:border-brand-500 focus:bg-surface-0 focus:outline-none focus:ring-2 focus:ring-brand-500/40 ${className}`}
        {...rest}
      />
    )
  }
)
