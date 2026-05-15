import { NextResponse } from 'next/server'
import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth.config'
import type { Role } from '@/types'

const { auth } = NextAuth(authConfig)

const protectedPathPrefixes = [
  '/dashboard',
  '/history',
  '/liked',
  '/settings',
  '/upload',
  '/go-live',
  '/studio',
  '/moderator'
]

const adminPathPrefixes = [
  '/admin'
]

function startsWithSegment(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Always allow RTMP ingest webhooks — called by nginx-rtmp container, no session.
  if (pathname.startsWith('/api/streams/ingest')) {
    return NextResponse.next()
  }

  const isAdmin = adminPathPrefixes.some((prefix) => startsWithSegment(pathname, prefix))
  const isAdminApi = startsWithSegment(pathname, '/api/admin')
  const isModeratorReportsApi = startsWithSegment(pathname, '/api/admin/reports')
  const isCreatorUsersApi = startsWithSegment(pathname, '/api/admin/users')
  const isModeratorArea = startsWithSegment(pathname, '/moderator')
  const isCreatorOnly = startsWithSegment(pathname, '/go-live')
  const isProtected =
    isAdmin ||
    isAdminApi ||
    protectedPathPrefixes.some((prefix) => startsWithSegment(pathname, prefix))

  if (isProtected && !session) {
    const url = new URL('/login', req.url)
    url.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(url)
  }

  if (isModeratorArea && session && !['admin', 'moderator'].includes(session.user.role as Role)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  if (isModeratorReportsApi && session && !['admin', 'moderator'].includes(session.user.role as Role)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  if (isCreatorUsersApi && session && !['admin', 'creator'].includes(session.user.role as Role)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  if ((isAdmin || (isAdminApi && !isModeratorReportsApi && !isCreatorUsersApi)) && session?.user?.role !== 'admin') {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  if (isCreatorOnly && session && !['admin', 'creator'].includes(session.user.role as Role)) {
    return NextResponse.redirect(new URL('/403', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/history/:path*',
    '/liked/:path*',
    '/settings/:path*',
    '/upload/:path*',
    '/go-live/:path*',
    '/studio/:path*',
    '/moderator/:path*',
    '/admin/:path*',
    '/api/admin/:path*'
  ]
}
