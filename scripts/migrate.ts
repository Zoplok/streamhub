import { readFileSync } from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'

async function main() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'Zz11zz211!',
    database: 'streamhub',
    connectionLimit: 20
  })

  const sql = readFileSync(path.join(process.cwd(), 'scripts', 'schema.sql'), 'utf8')
  // Split by semicolon and filter empty statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
  
  const ignorableCodes = new Set([
    'ER_DUP_KEYNAME',       // duplicate index name
    'ER_TABLE_EXISTS_ERROR', // table already exists
    'ER_DUP_ENTRY',         // duplicate entry (INSERT IGNORE handles, but just in case)
    'ER_DUP_FIELDNAME'      // duplicate column
  ])
  for (const stmt of statements) {
    try {
      await pool.execute(stmt)
    } catch (err) {
      const code = (err as { code?: string }).code
      if (code && ignorableCodes.has(code)) {
        continue
      }
      throw err
    }
  }
  await pool.end()
  console.log('migrations applied')
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
