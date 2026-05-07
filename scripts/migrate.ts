import { readFileSync } from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'
import { Pool as NeonPool } from '@neondatabase/serverless'
import { config as loadEnv } from 'dotenv'

loadEnv({ path: '.env.local' })
loadEnv({ path: '.env' })

function splitStatements(sql: string) {
  return sql
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
}

async function migratePostgres() {
  const databaseUrl = process.env.DATABASE_URL?.trim()
  if (!databaseUrl) throw new Error('DATABASE_URL is required for Postgres migrations')
  const pool = new NeonPool({ connectionString: databaseUrl })
  const sql = readFileSync(path.join(process.cwd(), 'scripts', 'schema.postgres.sql'), 'utf8')

  try {
    for (const stmt of splitStatements(sql)) {
      await pool.query(stmt)
    }
  } finally {
    await pool.end()
  }
}

async function migrateMysql() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: (process.env.DB_PASSWORD || '').trim(),
    database: process.env.DB_NAME || 'streamhub',
    connectionLimit: 20
  })

  const sql = readFileSync(path.join(process.cwd(), 'scripts', 'schema.sql'), 'utf8')
  const ignorableCodes = new Set([
    'ER_DUP_KEYNAME',
    'ER_TABLE_EXISTS_ERROR',
    'ER_DUP_ENTRY',
    'ER_DUP_FIELDNAME'
  ])

  try {
    for (const stmt of splitStatements(sql)) {
      try {
        await pool.execute(stmt)
      } catch (err) {
        const code = (err as { code?: string }).code
        if (code && ignorableCodes.has(code)) continue
        throw err
      }
    }
  } finally {
    await pool.end()
  }
}

async function main() {
  if (process.env.DATABASE_URL?.trim()) {
    await migratePostgres()
  } else {
    await migrateMysql()
  }
  console.log('migrations applied')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
