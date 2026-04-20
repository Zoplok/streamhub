import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notifyChannelSubscribers } from '@/lib/notifications'

// nginx-rtmp on_publish webhook.
//
// nginx-rtmp sends a GET (notify_method get) with query params:
//   name = the stream name published by OBS (i.e. the stream key)
//   app  = rtmp application name ("live")
//   addr = client IP
//
// We validate the stream key, flip the stream to "live", and return
// HTTP 302 Location: rtmp://<host>/live/<stream_id>
// so nginx-rtmp *rewrites* the stream name to the UUID. The HLS playlist
// is then served at <stream_id>.m3u8 — never exposing the secret key.

async function handle(req: NextRequest) {
  // Accept both GET (query params) and POST (form body) for flexibility.
  let name = req.nextUrl.searchParams.get('name') ?? ''
  if (!name && req.method === 'POST') {
    try {
      const form = await req.formData()
      name = String(form.get('name') ?? '')
    } catch {
      /* ignore */
    }
  }

  if (!name) {
    return new NextResponse('missing name', { status: 400 })
  }

  try {
    // `name` is either a stream UUID (browser studio push) or a stream_key (OBS push).
    const result = await db.query<{ id: string; channel_id: string; title: string; prev_status: string; channel_name: string; user_id: string; thumbnail_url: string | null }>(
      `SELECT ls.id, ls.channel_id, ls.title, ls.status AS prev_status, ls.thumbnail_url,
              c.name AS channel_name, c.user_id
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=? OR ls.stream_key=? LIMIT 1`,
      [name, name]
    )
    const row = result.rows[0]
    if (!row) {
      console.warn('[ingest] rejected publish:', name.slice(0, 12) + '…')
      return new NextResponse('invalid stream', { status: 403 })
    }

    const hlsBase = process.env.HLS_PUBLIC_URL ?? 'http://localhost:8080/hls'
    // HLS path matches whatever nginx-rtmp wrote to disk — the raw `name`.
    const hlsUrl = `${hlsBase.replace(/\/$/, '')}/${name}.m3u8`

    await db.query(
      `UPDATE live_streams
       SET status='live', started_at=CURRENT_TIMESTAMP, ended_at=NULL, hls_url=?
       WHERE id=?`,
      [hlsUrl, row.id]
    )

    console.log('[ingest] stream live:', row.id, 'rtmp-name:', name.slice(0, 12) + '…')

    // Fan out "went live" notification only on transition into live.
    if (row.prev_status !== 'live') {
      void notifyChannelSubscribers(row.channel_id, {
        actorId: row.user_id,
        type: 'new_live',
        title: `${row.channel_name} is live now`,
        body: row.title,
        link: `/live/${row.id}`,
        thumbnail: row.thumbnail_url
      })
    }

    // 2xx → nginx-rtmp accepts the publish.
    return new NextResponse('ok', { status: 200 })
  } catch (err) {
    console.error('[ingest] error:', err)
    return new NextResponse('server error', { status: 500 })
  }
}

export const GET = handle
export const POST = handle
