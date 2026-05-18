interface StripeCheckoutCreateArgs {
  amountCents: number
  currency: string
  productName: string
  successUrl: string
  cancelUrl: string
  metadata: Record<string, string>
  customerEmail?: string | null
}

interface StripeCheckoutSession {
  id: string
  url: string | null
  payment_status: string
  status: string
  metadata?: Record<string, string>
  payment_intent?: string | null
}

function stripeSecret() {
  return process.env.STRIPE_SECRET_KEY?.trim() ?? ''
}

export function hasCardPaymentsConfigured() {
  return Boolean(stripeSecret())
}

async function stripeRequest(path: string, init: RequestInit) {
  const secret = stripeSecret()
  if (!secret) {
    throw new Error('Card payments are not configured. Missing STRIPE_SECRET_KEY.')
  }

  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(init.headers ?? {})
    }
  })

  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | StripeCheckoutSession
    | null

  if (!response.ok) {
    const msg = payload && 'error' in payload ? payload.error?.message : null
    throw new Error(msg || `Stripe request failed (${response.status})`)
  }

  return payload as StripeCheckoutSession
}

export async function createStripeCheckoutSession(args: StripeCheckoutCreateArgs) {
  const body = new URLSearchParams()
  body.set('mode', 'payment')
  body.set('success_url', args.successUrl)
  body.set('cancel_url', args.cancelUrl)
  body.set('payment_method_types[0]', 'card')
  body.set('line_items[0][quantity]', '1')
  body.set('line_items[0][price_data][currency]', args.currency.toLowerCase())
  body.set('line_items[0][price_data][unit_amount]', String(args.amountCents))
  body.set('line_items[0][price_data][product_data][name]', args.productName.slice(0, 120))
  body.set('allow_promotion_codes', 'false')
  body.set('submit_type', 'donate')

  if (args.customerEmail) {
    body.set('customer_email', args.customerEmail)
  }

  for (const [k, v] of Object.entries(args.metadata)) {
    body.set(`metadata[${k}]`, v)
  }

  return stripeRequest('checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString()
  })
}

export async function getStripeCheckoutSession(sessionId: string) {
  return stripeRequest(`checkout/sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET'
  })
}
