import Redis from 'ioredis'

let client: Redis | null = null
let disabledUntil = 0
const redisRetryCooldownMs = Number(process.env.REDIS_RETRY_COOLDOWN_MS ?? 30_000)

function markRedisUnavailable(reason: unknown) {
  disabledUntil = Date.now() + redisRetryCooldownMs
  const message = reason instanceof Error ? reason.message : String(reason)
  console.warn(`[redis] unavailable, retrying in ${redisRetryCooldownMs}ms:`, message)
  client?.disconnect()
  client = null
}

export function getRedis() {
  const url = process.env.REDIS_URL?.trim()
  if (!url || Date.now() < disabledUntil) return null
  if (!client) {
    client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: () => null
    })
    client.on('error', (err) => {
      markRedisUnavailable(err)
    })
  }
  return client
}

export async function getJson<T>(key: string): Promise<T | null> {
  const redis = getRedis()
  if (!redis) return null
  try {
    if (redis.status === 'wait') await redis.connect()
    const cached = await redis.get(key)
    return cached ? JSON.parse(cached) as T : null
  } catch (err) {
    markRedisUnavailable(err)
    return null
  }
}

export async function setJson(key: string, value: unknown, ttlSeconds: number) {
  const redis = getRedis()
  if (!redis) return
  try {
    if (redis.status === 'wait') await redis.connect()
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds)
  } catch (err) {
    markRedisUnavailable(err)
  }
}

export async function deleteByPattern(pattern: string) {
  const redis = getRedis()
  if (!redis) return
  try {
    if (redis.status === 'wait') await redis.connect()
    const stream = redis.scanStream({ match: pattern, count: 100 })
    for await (const keys of stream) {
      const batch = keys as string[]
      if (batch.length) await redis.del(...batch)
    }
  } catch (err) {
    markRedisUnavailable(err)
  }
}

export function cacheKey(prefix: string, parts: Record<string, unknown>) {
  const stable = Object.keys(parts)
    .sort()
    .map((key) => `${key}:${String(parts[key] ?? '')}`)
    .join('|')
  return `${prefix}:${stable}`
}

export async function invalidateStreamCaches() {
  await deleteByPattern('streams:list:*')
}

export async function invalidateVideoCaches() {
  await deleteByPattern('videos:list:*')
}
