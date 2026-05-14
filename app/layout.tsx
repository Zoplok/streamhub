import './globals.css'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { Navbar } from '@/components/ui/Navbar'
import { Sidebar } from '@/components/ui/Sidebar'
import { ThemeProvider } from '@/lib/theme'
import { SidebarProvider } from '@/components/ui/SidebarContext'

export const metadata: Metadata = {
  title: 'StreamHub — Live, Videos & Shorts',
  description: 'Videos, live streams, and shorts — all in one place.'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' }
  ]
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                try {
                  var key = 'streamhub-theme';
                  var theme = localStorage.getItem(key);
                  if (theme !== 'dark' && theme !== 'light') {
                    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
                  }
                  document.documentElement.classList.remove('dark', 'light');
                  document.documentElement.classList.add(theme);
                  document.documentElement.style.colorScheme = theme;
                } catch (_) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <SidebarProvider>
            <Navbar />
            <div className="flex min-w-0">
              <Sidebar />
              <main className="min-h-[calc(100vh-6.5rem)] min-w-0 flex-1 transition-colors duration-200 sm:min-h-[calc(100vh-3.5rem)]">
                {children}
              </main>
            </div>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
