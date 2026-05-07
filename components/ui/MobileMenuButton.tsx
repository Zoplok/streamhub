'use client'

import { Menu, X } from 'lucide-react'
import { useSidebar } from './SidebarContext'

export function MobileMenuButton() {
  const { open, toggle } = useSidebar()
  return (
    <button
      onClick={toggle}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-neutral-300 transition-colors hover:bg-surface-2 hover:text-white lg:hidden"
      aria-label={open ? 'Close menu' : 'Open menu'}
    >
      {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  )
}
