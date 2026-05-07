import { NextResponse } from 'next/server'

function thresholdFromEnv(name: string, fallback: number) {
  const value = Number(process.env[name])
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

export function logTiming(label: string, startedAt: number, thresholdMs: number) {
  const durationMs = Math.round(performance.now() - startedAt)
  if (durationMs >= thresholdMs) {
    console.warn(`[perf] ${label} took ${durationMs}ms`)
  }
}

export async function withApiTiming<T extends NextResponse>(
  label: string,
  fn: () => Promise<T>,
  thresholdMs = thresholdFromEnv('API_SLOW_REQUEST_MS', 100)
) {
  const startedAt = performance.now()
  try {
    const response = await fn()
    const durationMs = Math.round(performance.now() - startedAt)
    response.headers.set('Server-Timing', `app;dur=${durationMs}`)
    if (durationMs >= thresholdMs) {
      console.warn(`[perf] ${label} ${response.status} took ${durationMs}ms`)
    }
    return response
  } catch (err) {
    logTiming(`${label} failed`, startedAt, thresholdMs)
    throw err
  }
}
