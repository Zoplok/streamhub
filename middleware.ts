import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'

const { auth } = NextAuth(authConfig)

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Always allow RTMP ingest webhooks — called by nginx-rtmp container, no session.
  if (pathname.startsWith('/api/streams/ingest')) {
    return NextResponse.next()
  }

  const isAdmin = pathname.startsWith('/admin')
  const isProtected =
    isAdmin ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/upload') ||
    pathname.startsWith('/go-live')

  if (isProtected && !session) {
    const url = new URL('/login', req.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  if (isAdmin && session?.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  if (pathname.startsWith('/go-live') && session && !['admin', 'creator'].includes(session.user.role)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/dashboard/:path*', '/upload/:path*', '/go-live/:path*', '/admin/:path*']
}
