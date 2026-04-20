import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Navbar } from '@/components/ui/Navbar'
import { Sidebar } from '@/components/ui/Sidebar'

export const metadata: Metadata = {
  title: 'StreamHub — Live, Videos & Shorts',
  description: 'Videos, live streams, and shorts — all in one place.'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Navbar />
        <div className="flex">
          <Sidebar />
          <main className="min-h-[calc(100vh-3.5rem)] flex-1">{children}</main>
        </div>
      </body>
    </html>
  )
}
