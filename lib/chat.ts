import { randomUUID } from 'node:crypto'
import { db } from './db'
import { moderateText } from './ai/moderation'
import { getAIModel, getOpenAI, hasOpenAIKey } from './ai/openai'

export interface ChatMsg {
  id: string
  stream_id: string
  user_id: string
  username: string
  content: string
  created_at: string
  flagged?: string
  bot?: boolean
}

export const BOT_USER_ID = '00000000-0000-0000-0000-0000000000b0'
export const BOT_NAME = 'StreamBot'

type ChatMessageRow = {
  id: string
  stream_id: string
  user_id: string
  username: string | null
  content: string
  created_at: string | Date
}

function normalizeDate(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString()
}

function toChatMsg(row: ChatMessageRow): ChatMsg {
  return {
    id: row.id,
    stream_id: row.stream_id,
    user_id: row.user_id,
    username: row.username ?? (row.user_id === BOT_USER_ID ? BOT_NAME : 'Unknown'),
    content: row.content,
    created_at: normalizeDate(row.created_at),
    bot: row.user_id === BOT_USER_ID || row.username === BOT_NAME || undefined
  }
}

async function callBotLLM(ctx: string, question: string, asker?: string): Promise<string> {
  const system = `You are "StreamBot", a friendly AI chat assistant inside a live stream.

CURRENT STREAM CONTEXT (always use this when answering):
${ctx}

Rules:
- ALWAYS reference the stream title / streamer / category when the question is about "this stream", "the streamer", or similar.
- Reply in 1-2 sentences, max 240 chars.
- Be helpful, warm, and never toxic. No slurs, no medical/legal advice.
- Never include URLs or @mentions.
- If the question is generic ("hi", "hello"), greet the asker and mention the stream title briefly.`

  const userMsg = asker ? `[${asker}]: ${question}` : question

  const res = await getOpenAI().chat.completions.create({
    model: getAIModel(),
    temperature: 0.5,
    max_tokens: 140,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userMsg }
    ]
  })
  return (res.choices[0]?.message.content ?? '').trim()
}

export async function askStreamBot(streamId: string, question: string, asker?: string): Promise<string> {
  let stream: { title: string; channel_name: string; viewer_count: number; category: string | null } | undefined
  try {
    const streamRes = await db.query<{
      title: string
      channel_name: string
      status: string
      viewer_count: number
      category: string | null
    }>(
      `SELECT ls.title, ls.status, ls.viewer_count, ls.category, c.name AS channel_name
       FROM live_streams ls JOIN channels c ON c.id = ls.channel_id
       WHERE ls.id=? LIMIT 1`,
      [streamId]
    )
    stream = streamRes.rows[0]
  } catch (err) {
    console.error('[StreamBot] stream lookup failed', err)
  }

  const ctx = stream
    ? `Stream: "${stream.title}" by ${stream.channel_name} - ${stream.viewer_count} viewers - category: ${stream.category ?? 'n/a'}`
    : 'No stream info.'

  if (!hasOpenAIKey()) {
    return 'StreamBot is sleeping. Set OPENAI_API_KEY to wake me up.'
  }

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const text = await callBotLLM(ctx, question, asker)
      if (!text) return "I didn't catch that. Try rephrasing?"
      return text.slice(0, 240)
    } catch (err) {
      const e = err as { status?: number; message?: string; code?: string }
      console.error(`[StreamBot] LLM error (attempt ${attempt + 1})`, e.status, e.code, e.message)
      if (e.status === 429 && attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1500))
        continue
      }
      if (e.status === 429) return 'Too many questions at once. Give me a minute to cool down.'
      if (e.status === 401 || e.status === 403) return 'My API key was rejected. Ask an admin to check the AI config.'
      if (e.status === 404) return "That model does not exist on the configured provider. Check OPENAI_MODEL."
      if ((e.message ?? '').includes('ENOTFOUND') || (e.message ?? '').includes('ECONNREFUSED')) {
        return 'Cannot reach the AI provider right now.'
      }
      return 'Something went wrong. Try again in a sec.'
    }
  }
  return 'Brain freeze. Try again in a moment.'
}

export async function listChatMessages(streamId: string, after?: string, limit = 100): Promise<ChatMsg[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 200)
  const params: unknown[] = [BOT_NAME, streamId]
  let afterClause = ''
  if (after) {
    afterClause = 'AND cm.created_at >= ?'
    params.push(after)
  }
  params.push(safeLimit)

  const result = await db.query<ChatMessageRow>(
    `SELECT cm.id, cm.stream_id, cm.user_id, COALESCE(u.username, ?) AS username, cm.content, cm.created_at
     FROM chat_messages cm
     LEFT JOIN users u ON u.id = cm.user_id
     WHERE cm.stream_id = ? ${afterClause}
     ORDER BY cm.created_at ASC
     LIMIT ?`,
    params
  )
  return result.rows.map(toChatMsg)
}

export async function sendChatMessage({
  streamId,
  userId,
  username,
  content
}: {
  streamId: string
  userId: string
  username: string
  content: string
}): Promise<{ messages: ChatMsg[] } | { blocked: { reason: string; categories: string[] } }> {
  const sanitized = content.replace(/[<>]/g, '').trim().slice(0, 500)
  if (!sanitized) return { messages: [] }

  const mod = await moderateText(sanitized)
  if (mod.severity === 'block') {
    return {
      blocked: {
        reason: mod.reason ?? 'blocked by moderation',
        categories: mod.categories
      }
    }
  }

  const id = randomUUID()
  await db.query(
    'INSERT INTO chat_messages (id, stream_id, user_id, content) VALUES (?,?,?,?)',
    [id, streamId, userId, sanitized]
  )

  const messages: ChatMsg[] = [
    {
      id,
      stream_id: streamId,
      user_id: userId,
      username,
      content: sanitized,
      created_at: new Date().toISOString(),
      flagged: mod.severity === 'warn' ? (mod.reason ?? 'flagged') : undefined
    }
  ]

  const match = sanitized.match(/^@streambot\b[:,]?\s*(.*)$/i)
  if (match) {
    const question = match[1].trim() || 'Say hi to the chat.'
    const reply = await askStreamBot(streamId, question, username)
    messages.push({
      id: randomUUID(),
      stream_id: streamId,
      user_id: BOT_USER_ID,
      username: BOT_NAME,
      content: reply,
      created_at: new Date().toISOString(),
      bot: true
    })
  }

  return { messages }
}
