import mysql from 'mysql2/promise'
import { Pool as NeonPool, type PoolClient as NeonPoolClient } from '@neondatabase/serverless'
import { logTiming } from './perf'

interface QueryResult<T> {
  rows: T[]
  rowCount: number
}

interface DbClient {
  query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>>
}

const databaseUrl = process.env.DATABASE_URL?.trim()
const usePostgres = Boolean(databaseUrl)

const mysqlPool: mysql.Pool | null = usePostgres
  ? null
  : mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      user: process.env.DB_USER || 'root',
      password: (process.env.DB_PASSWORD || '').trim(),
      database: process.env.DB_NAME || 'streamhub',
      connectionLimit: 20,
      waitForConnections: true,
      queueLimit: 0
    })

const neonPool: NeonPool | null = usePostgres
  ? new NeonPool({ connectionString: databaseUrl })
  : null

function replaceQuestionPlaceholders(sql: string) {
  let index = 0
  let out = ''
  let quote: "'" | '"' | '`' | null = null

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i]
    const prev = sql[i - 1]

    if (quote) {
      out += char
      if (char === quote && prev !== '\\') quote = null
      continue
    }

    if (char === "'" || char === '"' || char === '`') {
      quote = char
      out += char === '`' ? '"' : char
      continue
    }

    if (char === '?') {
      index++
      out += `$${index}`
      continue
    }

    out += char
  }

  return out
}

function toPostgresSql(sql: string) {
  let converted = sql
    .replace(/CAST\(\s*COALESCE\(SUM\(([^)]+)\),\s*0\)\s+AS\s+SIGNED\s*\)/gi, 'COALESCE(SUM($1), 0)::int')
    .replace(/CAST\(\s*COUNT\(([^)]*)\)\s+AS\s+SIGNED\s*\)/gi, 'COUNT($1)::int')
    .replace(/CAST\(\s*SUM\(([\s\S]+?)\)\s+AS\s+SIGNED\s*\)/gi, 'SUM($1)::int')
    .replace(/CAST\(\s*\?\s+AS\s+JSON\s*\)/gi, '?::jsonb')
    .replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s+\?\s+HOUR\s*\)/gi, "(NOW() - (? * INTERVAL '1 hour'))")
    .replace(/DATE_SUB\(\s*(?:NOW\(\)|CURRENT_TIMESTAMP)\s*,\s*INTERVAL\s+(\d+)\s+(\w+)\s*\)/gi, "(NOW() - INTERVAL '$1 $2')")
    .replace(/\bRAND\(\)/gi, 'RANDOM()')
    .replace(/JSON_CONTAINS\(([^,]+),\s*JSON_QUOTE\(\?\)\)/gi, '$1::jsonb @> jsonb_build_array(?::text)')
    .replace(/TIMESTAMPDIFF\(\s*SECOND\s*,\s*([^,]+)\s*,\s*NOW\(\)\s*\)/gi, 'EXTRACT(EPOCH FROM (NOW() - $1))')
    .replace(/INSERT\s+IGNORE\s+INTO\s+subscriptions\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi, 'INSERT INTO subscriptions ($1) VALUES ($2) ON CONFLICT (subscriber_id, channel_id) DO NOTHING')
    .replace(/ON\s+DUPLICATE\s+KEY\s+UPDATE\s+type\s*=\s*VALUES\(type\)/gi, 'ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET type = EXCLUDED.type')
    .replace(/JSON_ARRAY\(\)/gi, "'[]'::jsonb")

  converted = replaceQuestionPlaceholders(converted)
  return converted
}

async function queryPostgres<T>(text: string, params: unknown[] = [], client?: NeonPool | NeonPoolClient): Promise<QueryResult<T>> {
  const runner = client ?? neonPool
  if (!runner) throw new Error('DATABASE_URL is not configured')
  const result = await runner.query(toPostgresSql(text), params)
  return { rows: result.rows as T[], rowCount: result.rowCount ?? result.rows.length }
}

async function queryMysql<T>(text: string, params: unknown[] = [], client?: mysql.Pool | mysql.PoolConnection): Promise<QueryResult<T>> {
  const runner = client ?? mysqlPool
  if (!runner) throw new Error('MySQL is not configured')
  const [rows] = await runner.query(text, params as never) as [T[], unknown]
  return { rows, rowCount: Array.isArray(rows) ? rows.length : 0 }
}

export const db = {
  async query<T = unknown>(
    text: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    const startedAt = performance.now()
    const result = usePostgres
      ? await queryPostgres<T>(text, params)
      : await queryMysql<T>(text, params)
    const thresholdMs = Number(process.env.DB_SLOW_QUERY_MS ?? 100)
    logTiming(`db ${text.replace(/\s+/g, ' ').trim().slice(0, 140)}`, startedAt, thresholdMs)
    return result
  },
  async tx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
    if (usePostgres) {
      if (!neonPool) throw new Error('DATABASE_URL is not configured')
      const client = await neonPool.connect()
      const wrapped: DbClient = {
        query: (text, params = []) => queryPostgres(text, params, client)
      }
      try {
        await client.query('BEGIN')
        const result = await fn(wrapped)
        await client.query('COMMIT')
        return result
      } catch (err) {
        await client.query('ROLLBACK')
        throw err
      } finally {
        client.release()
      }
    }

    if (!mysqlPool) throw new Error('MySQL is not configured')
    const conn = await mysqlPool.getConnection()
    const wrapped: DbClient = {
      query: (text, params = []) => queryMysql(text, params, conn)
    }
    try {
      await conn.beginTransaction()
      const result = await fn(wrapped)
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },
  pool: neonPool ?? mysqlPool
}
