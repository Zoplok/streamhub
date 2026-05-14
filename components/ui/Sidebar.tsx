'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import {
  Home,
  Flame,
  Radio,
  Film,
  Compass,
  History,
  ThumbsUp,
  Gamepad2,
  Music2,
  Clapperboard,
  Trophy,
  Newspaper,
  Settings
} from 'lucide-react'
import type { ComponentType } from 'react'
import { useSidebar } from './SidebarContext'

interface Item {
  href: string
  label: string
  icon: ComponentType<{ className?: string }>
}

const main: Item[] = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/live', label: 'Live', icon: Radio },
  { href: '/shorts', label: 'Shorts', icon: Film },
  { href: '/trending', label: 'Trending', icon: Flame },
  { href: '/explore', label: 'Explore', icon: Compass }
]

const you: Item[] = [
  { href: '/history', label: 'History', icon: History },
  { href: '/liked', label: 'Liked', icon: ThumbsUp }
]

const categories: Item[] = [
  { href: '/c/gaming', label: 'Gaming', icon: Gamepad2 },
  { href: '/c/music', label: 'Music', icon: Music2 },
  { href: '/c/film', label: 'Film', icon: Clapperboard },
  { href: '/c/sports', label: 'Sports', icon: Trophy },
  { href: '/c/news', label: 'News', icon: Newspaper }
]

function NavItem({ item, active }: { item: Item; active: boolean }) {
  const Icon = item.icon
  return (
    <Link
      href={item.href}
      className={[
        'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-surface-3 text-white font-semibold'
          : 'text-neutral-300 hover:bg-surface-2 hover:text-white'
      ].join(' ')}
    >
      <Icon className={['h-5 w-5', active ? 'text-brand-500' : 'text-neutral-400 group-hover:text-neutral-200'].join(' ')} />
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

function Section({ title, items, pathname }: { title?: string; items: Item[]; pathname: string }) {
  return (
    <div className="py-2">
      {title && (
        <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">{title}</p>
      )}
      <div className="space-y-0.5">
        {items.map((i) => (
          <NavItem key={i.href} item={i} active={pathname === i.href} />
        ))}
      </div>
    </div>
  )
}

function SidebarContent({ pathname }: { pathname: string }) {
  return (
    <>
      <Section items={main} pathname={pathname} />
      <div className="my-2 border-t border-surface-3" />
      <Section title="You" items={you} pathname={pathname} />
      <div className="my-2 border-t border-surface-3" />
      <Section title="Browse" items={categories} pathname={pathname} />
      <div className="my-2 border-t border-surface-3" />
      <div className="py-2">
        <NavItem item={{ href: '/settings', label: 'Settings', icon: Settings }} active={pathname === '/settings'} />
      </div>
      <p className="mt-4 px-3 text-[11px] leading-relaxed text-neutral-600">
        StreamHub © {new Date().getFullYear()}
      </p>
    </>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { open, close } = useSidebar()

  useEffect(() => {
    close()
  }, [pathname, close])

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={[
          'fixed inset-0 z-30 bg-black/60 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        ].join(' ')}
        onClick={close}
        aria-hidden="true"
      />

      {/* Mobile drawer */}
      <aside
        className={[
          'fixed left-0 top-[6.5rem] z-40 h-[calc(100vh-6.5rem)] w-64 max-w-[85vw] overflow-y-auto sm:top-14 sm:h-[calc(100vh-3.5rem)]',
          'border-r border-surface-3 bg-surface-1 px-3 py-3',
          'transition-transform duration-200 ease-in-out lg:hidden',
          open ? 'translate-x-0' : '-translate-x-full'
        ].join(' ')}
      >
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Desktop sidebar */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-surface-3 bg-surface-1 px-3 py-3 lg:block">
        <SidebarContent pathname={pathname} />
      </aside>
    </>
  )
}
