import OpenAI from 'openai'

let cachedKey = ''
let cachedBase = ''
let client: OpenAI | null = null

export function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY ?? ''
  const base = process.env.OPENAI_BASE_URL ?? ''
  // Re-build the client whenever the env changes (important in dev after .env edits).
  if (!client || key !== cachedKey || base !== cachedBase) {
    client = new OpenAI({
      apiKey: key,
      baseURL: base || undefined
    })
    cachedKey = key
    cachedBase = base
  }
  return client
}

export const AI_MODERATION_MODEL = 'omni-moderation-latest'

/** Current model — read fresh each call so .env edits take effect without restart. */
export function getAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini'
}

/** Back-compat export — evaluated once at import time. Prefer getAIModel(). */
export const AI_MODEL = process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

export function hasOpenAIKey(): boolean {
  const key = process.env.OPENAI_API_KEY ?? ''
  if (!key) return false
  if (key.startsWith('sk-...')) return false
  if (key === 'your-openai-api-key' || key === 'changeme') return false
  return true
}

/**
 * Returns true when the configured endpoint is the real OpenAI API
 * (so features like /v1/moderations and response_format:json_object are available).
 */
export function isNativeOpenAI(): boolean {
  const base = (process.env.OPENAI_BASE_URL ?? '').toLowerCase()
  if (!base) return true
  return base.includes('api.openai.com')
}
