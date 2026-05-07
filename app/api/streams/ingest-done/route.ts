import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { invalidateStreamCaches } from '@/lib/redis'
import { withApiTiming } from '@/lib/perf'

// nginx-rtmp on_publish_done webhook.
// After the 302 rewrite on publish, `name` here is the stream UUID.

async function handle(req: NextRequest) {
  return withApiTiming(`${req.method} /api/streams/ingest-done`, async () => {
  let name = req.nextUrl.searchParams.get('name') ?? ''
  if (!name && req.method === 'POST') {
    try {
      const form = await req.formData()
      name = String(form.get('name') ?? '')
    } catch {
      /* ignore */
    }
  }
  if (!name) return new NextResponse('missing name', { status: 400 })

  try {
    // `name` may be a UUID (post-rewrite) or a raw stream_key (pre-rewrite fallback).
    await db.query(
      `UPDATE live_streams
       SET status='ended', ended_at=CURRENT_TIMESTAMP
       WHERE id=? OR stream_key=?`,
      [name, name]
    )
    await invalidateStreamCaches()
    console.log('[ingest-done] stream ended:', name)
    return new NextResponse('ok', { status: 200 })
  } catch (err) {
    console.error('[ingest-done] error:', err)
    return new NextResponse('server error', { status: 500 })
  }
  })
}

export const GET = handle
export const POST = handle
