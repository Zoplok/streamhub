import { randomUUID } from 'node:crypto'
import { db } from './db'

export type NotificationType =
  | 'new_video'
  | 'new_live'
  | 'new_comment'
  | 'comment_reply'
  | 'new_like'
  | 'new_subscriber'
  | 'system'

export interface CreateNotificationInput {
  userId: string
  actorId?: string | null
  type: NotificationType
  title: string
  body?: string | null
  link?: string | null
  thumbnail?: string | null
}

/**
 * Insert a notification. Silently logs and swallows errors — we never want a
 * notification failure to break the user-facing action that triggered it.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  if (input.actorId && input.actorId === input.userId) return // don't notify yourself
  try {
    await db.query(
      `INSERT INTO notifications (id, user_id, actor_id, type, title, body, link, thumbnail)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        randomUUID(),
        input.userId,
        input.actorId ?? null,
        input.type,
        input.title.slice(0, 255),
        (input.body ?? null)?.toString().slice(0, 500) ?? null,
        (input.link ?? null)?.toString().slice(0, 500) ?? null,
        (input.thumbnail ?? null)?.toString().slice(0, 500) ?? null
      ]
    )
  } catch (err) {
    console.error('[notifications] insert failed:', err)
  }
}

/**
 * Fan out a notification to every subscriber of a channel.
 */
export async function notifyChannelSubscribers(
  channelId: string,
  input: Omit<CreateNotificationInput, 'userId'>
): Promise<void> {
  try {
    const subs = await db.query<{ subscriber_id: string }>(
      'SELECT subscriber_id FROM subscriptions WHERE channel_id = ?',
      [channelId]
    )
    if (subs.rows.length === 0) return
    await Promise.all(
      subs.rows.map((s) =>
        createNotification({ ...input, userId: s.subscriber_id })
      )
    )
  } catch (err) {
    console.error('[notifications] fanout failed:', err)
  }
}
