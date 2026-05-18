import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { createStripeCheckoutSession, hasCardPaymentsConfigured } from '@/lib/payments'
import { SUPERCHAT_MAX_USD, SUPERCHAT_MIN_USD } from '@/lib/superchat'

export const runtime = 'nodejs'

const idSchema = z.string().uuid()
const bodySchema = z.object({
  amount_usd: z.coerce.number().min(SUPERCHAT_MIN_USD).max(SUPERCHAT_MAX_USD),
  message: z.string().min(1).max(250),
  currency: z.string().min(3).max(10).optional().default('usd')
})

type StreamRow = {
  id: string
  title: string
  channel_id: string
  channel_owner_id: string
  channel_name: string
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid stream id' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  if (!hasCardPaymentsConfigured()) {
    return NextResponse.json(
      { error: 'Card payments are not configured yet. Ask admin to set STRIPE_SECRET_KEY.' },
      { status: 503 }
    )
  }

  try {
    const streamRes = await db.query<StreamRow>(
      `SELECT ls.id, ls.title, ls.channel_id, c.user_id AS channel_owner_id, c.name AS channel_name
       FROM live_streams ls
       JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=? LIMIT 1`,
      [params.id]
    )
    const stream = streamRes.rows[0]
    if (!stream) return NextResponse.json({ error: 'Stream not found' }, { status: 404 })
    if (stream.channel_owner_id === session.user.id) {
      return NextResponse.json({ error: 'You cannot superchat your own stream.' }, { status: 400 })
    }

    const amountCents = Math.round(parsed.data.amount_usd * 100)
    const superchatId = randomUUID()
    const currency = parsed.data.currency.toLowerCase()
    const message = parsed.data.message.trim()

    await db.query(
      `INSERT INTO superchats (id, stream_id, channel_id, user_id, amount_cents, currency, message, status)
       VALUES (?,?,?,?,?,?,?,'pending')`,
      [superchatId, params.id, stream.channel_id, session.user.id, amountCents, currency, message]
    )

    const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXTAUTH_URL?.trim() || req.nextUrl.origin
    const successUrl = `${origin}/live/${params.id}?superchat=success&sc=${superchatId}&sid={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${origin}/live/${params.id}?superchat=cancel`

    const checkout = await createStripeCheckoutSession({
      amountCents,
      currency,
      productName: `Super Chat for ${stream.channel_name}`,
      successUrl,
      cancelUrl,
      metadata: {
        superchat_id: superchatId,
        stream_id: params.id,
        user_id: session.user.id
      },
      customerEmail: session.user.email ?? null
    })

    await db.query('UPDATE superchats SET stripe_session_id=? WHERE id=?', [checkout.id, superchatId])

    return NextResponse.json({
      data: {
        superchat_id: superchatId,
        checkout_url: checkout.url
      }
    })
  } catch (err) {
    console.error('[superchat checkout]', err)
    return NextResponse.json({ error: 'Unable to start card checkout' }, { status: 500 })
  }
}
