import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { getStripeCheckoutSession, hasCardPaymentsConfigured } from '@/lib/payments'
import { formatSuperchatContent } from '@/lib/superchat'
import { getIO } from '@/lib/socket'

export const runtime = 'nodejs'

const idSchema = z.string().uuid()
const bodySchema = z.object({
  superchat_id: z.string().uuid(),
  session_id: z.string().min(10).max(255)
})

type SuperchatRow = {
  id: string
  stream_id: string
  user_id: string
  amount_cents: number
  currency: string
  message: string
  status: string
  stripe_session_id: string | null
  stripe_payment_intent_id: string | null
  chat_message_id: string | null
  username: string | null
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid stream id' }, { status: 400 })
  }
  if (!hasCardPaymentsConfigured()) {
    return NextResponse.json({ error: 'Card payments are not configured.' }, { status: 503 })
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const rowRes = await db.query<SuperchatRow>(
      `SELECT sc.id, sc.stream_id, sc.user_id, sc.amount_cents, sc.currency, sc.message, sc.status,
              sc.stripe_session_id, sc.stripe_payment_intent_id, sc.chat_message_id, u.username
       FROM superchats sc
       JOIN users u ON u.id = sc.user_id
       WHERE sc.id=? AND sc.stream_id=? LIMIT 1`,
      [parsed.data.superchat_id, params.id]
    )
    const superchat = rowRes.rows[0]
    if (!superchat) return NextResponse.json({ error: 'Superchat not found' }, { status: 404 })
    if (superchat.user_id !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (superchat.stripe_session_id && superchat.stripe_session_id !== parsed.data.session_id) {
      return NextResponse.json({ error: 'Session mismatch' }, { status: 400 })
    }
    if (superchat.chat_message_id) {
      return NextResponse.json({ data: { status: superchat.status, already_confirmed: true } })
    }

    const checkout = await getStripeCheckoutSession(parsed.data.session_id)
    if (checkout.metadata?.superchat_id !== superchat.id || checkout.metadata?.stream_id !== params.id) {
      return NextResponse.json({ error: 'Payment metadata mismatch' }, { status: 400 })
    }
    if (checkout.payment_status !== 'paid') {
      return NextResponse.json({ error: 'Payment is not completed yet' }, { status: 400 })
    }

    const chatMessageId = randomUUID()
    const content = formatSuperchatContent(
      Number(superchat.amount_cents),
      superchat.currency || 'usd',
      superchat.message
    )

    await db.tx(async (client) => {
      const locked = await client.query<{ status: string; chat_message_id: string | null }>(
        `SELECT status, chat_message_id FROM superchats WHERE id=? LIMIT 1 FOR UPDATE`,
        [superchat.id]
      )
      if (locked.rows[0]?.chat_message_id) return

      await client.query(
        `INSERT INTO chat_messages (id, stream_id, user_id, content) VALUES (?,?,?,?)`,
        [chatMessageId, params.id, superchat.user_id, content]
      )
      await client.query(
        `UPDATE superchats
         SET status='paid', paid_at=CURRENT_TIMESTAMP, stripe_payment_intent_id=?, chat_message_id=?
         WHERE id=?`,
        [checkout.payment_intent ?? null, chatMessageId, superchat.id]
      )
    })

    const username = superchat.username ?? session.user.name ?? 'User'
    getIO()?.to(`stream:${params.id}`).emit('chat:message', {
      id: chatMessageId,
      stream_id: params.id,
      user_id: superchat.user_id,
      username,
      content,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      data: {
        status: 'paid',
        message_id: chatMessageId
      }
    })
  } catch (err) {
    console.error('[superchat confirm]', err)
    return NextResponse.json({ error: 'Unable to confirm payment' }, { status: 500 })
  }
}
