import { getOpenAI, AI_MODERATION_MODEL, hasOpenAIKey, isNativeOpenAI } from './openai'

export interface ModerationResult {
  flagged: boolean
  categories: string[]
  severity: 'ok' | 'warn' | 'block'
  reason?: string
}

// Fallback heuristic moderation when no API key is available.
// Regex-based so common obfuscations (n1gga, n i g g a, niggaaa) still match.
const SLUR_PATTERNS: RegExp[] = [
  /n\W*[i1!|]\W*g\W*g\W*[ae3r]+/i,           // n-word + variants
  /f\W*[a@4]\W*g\W*g?\W*[oi0]?\W*t?/i,       // f-slur + variants
  /r\W*[e3]\W*t\W*[a@4]\W*r\W*d/i,           // r-slur
  /\bkys\b|\bkms\b/i,                         // kill-yourself / self-harm encouragement
  /\bc\W*h\W*[i1]\W*n\W*k\W*s?\b/i,           // c-slur
  /\btr[a@]nn[yi]e?s?\b/i                     // t-slur
]

function heuristicModerate(text: string): ModerationResult {
  const lower = text.toLowerCase()
  const spamTerms = ['free v-bucks', 'free robux', 'free crypto', 'onlyfans', 'dm me', 'click here', 'buy followers']
  const urls = (lower.match(/https?:\/\//g) ?? []).length

  if (SLUR_PATTERNS.some((re) => re.test(text))) {
    return { flagged: true, severity: 'block', categories: ['hate'], reason: 'hateful language' }
  }
  if (spamTerms.filter((t) => lower.includes(t)).length >= 1 && urls >= 1) {
    return { flagged: true, severity: 'block', categories: ['spam'], reason: 'likely spam' }
  }
  if (urls >= 3) {
    return { flagged: true, severity: 'warn', categories: ['spam'], reason: 'too many links' }
  }
  if (text.length > 400 && /(.)\1{8,}/.test(text)) {
    return { flagged: true, severity: 'warn', categories: ['spam'], reason: 'character flood' }
  }
  return { flagged: false, severity: 'ok', categories: [] }
}

export async function moderateText(text: string): Promise<ModerationResult> {
  const trimmed = text.trim().slice(0, 2000)
  if (!trimmed) return { flagged: false, severity: 'ok', categories: [] }

  // Always run the cheap local check first.
  const local = heuristicModerate(trimmed)
  if (local.severity === 'block') return local

  // /v1/moderations is only available on the real OpenAI API. Gemini/Groq/etc.
  // don't implement it, so fall back to heuristic-only moderation there.
  if (!hasOpenAIKey() || !isNativeOpenAI()) return local

  try {
    const res = await getOpenAI().moderations.create({
      model: AI_MODERATION_MODEL,
      input: trimmed
    })
    const r = res.results[0]
    if (!r) return local

    const flaggedCategories = Object.entries(r.categories)
      .filter(([, v]) => v === true)
      .map(([k]) => k)

    const severe = flaggedCategories.some((c) =>
      ['sexual/minors', 'hate/threatening', 'violence/graphic', 'self-harm/intent', 'self-harm/instructions'].includes(c)
    )

    if (r.flagged) {
      return {
        flagged: true,
        severity: severe ? 'block' : 'warn',
        categories: flaggedCategories,
        reason: severe ? 'severe content' : flaggedCategories[0] ?? 'policy violation'
      }
    }
    return local
  } catch {
    return local
  }
}
