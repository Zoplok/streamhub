import { ButtonHTMLAttributes, forwardRef } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

const variants: Record<Variant, string> = {
  primary: 'bg-brand-500 hover:bg-brand-400 text-surface-0 shadow-[0_4px_16px_-4px_rgba(83,252,24,0.45)]',
  secondary: 'bg-surface-3 hover:bg-surface-4 text-neutral-100',
  ghost: 'bg-transparent hover:bg-surface-2 text-neutral-200',
  outline: 'bg-transparent border border-surface-4 hover:bg-surface-2 hover:border-surface-5 text-neutral-200',
  danger: 'bg-red-600 hover:bg-red-500 text-white'
}

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-full',
  md: 'h-10 px-5 text-sm rounded-full',
  lg: 'h-12 px-7 text-base rounded-full'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', className = '', ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 font-semibold tracking-tight transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/60 focus:ring-offset-2 focus:ring-offset-surface-0 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    />
  )
})
