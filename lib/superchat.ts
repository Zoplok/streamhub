export const SUPERCHAT_MIN_USD = 1
export const SUPERCHAT_MAX_USD = 500

export function formatSuperchatContent(amountCents: number, currency: string, message: string) {
  const normalizedCurrency = (currency || 'usd').toUpperCase()
  const sanitizedMessage = message.replace(/\s+/g, ' ').trim().slice(0, 250)
  return `[SUPERCHAT:${amountCents}:${normalizedCurrency}] ${sanitizedMessage}`
}

export function parseSuperchatContent(content: string) {
  const match = content.match(/^\[SUPERCHAT:(\d+):([A-Z]{3})\]\s*(.+)$/)
  if (!match) return null

  const amountCents = Number(match[1])
  if (!Number.isFinite(amountCents) || amountCents <= 0) return null

  return {
    amountCents,
    currency: match[2],
    message: match[3]
  }
}

export function formatMoneyFromCents(amountCents: number, currency: string) {
  const safeCurrency = (currency || 'USD').toUpperCase()
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: safeCurrency
  }).format(amountCents / 100)
}
