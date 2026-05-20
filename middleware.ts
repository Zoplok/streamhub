import { NextResponse } from 'next/server'
import { clerkMiddleware } from '@clerk/nextjs/server'

const protectedPathPrefixes = [
  '/dashboard',
  '/history',
  '/liked',
  '/settings',
  '/upload',
  '/go-live',
  '/studio',
  '/moderator',
  '/admin',
  '/api/ai',
  '/api/admin'
]

function startsWithSegment(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export default clerkMiddleware(async (auth, req) => {
  const { pathname, search } = req.nextUrl

  // Always allow RTMP ingest webhooks, called by nginx-rtmp container.
  if (pathname.startsWith('/api/streams/ingest')) {
    return NextResponse.next()
  }

  const isProtected = protectedPathPrefixes.some((prefix) => startsWithSegment(pathname, prefix))
  if (!isProtected) {
    return NextResponse.next()
  }

  const { userId } = await auth()
  if (!userId) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const url = new URL('/login', req.url)
    url.searchParams.set('callbackUrl', `${pathname}${search}`)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    // App/page routes (exclude API and static assets).
    '/((?!api|_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // API routes, but skip large multipart upload endpoints to avoid middleware 413.
    '/api/((?!videos$|shorts$).*)'
  ]
}
