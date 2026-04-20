import mysql from 'mysql2/promise'

const pool: mysql.Pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: (process.env.DB_PASSWORD || '').trim(),
  database: process.env.DB_NAME || 'streamhub',
  connectionLimit: 20,
  waitForConnections: true,
  queueLimit: 0
})

interface QueryResult<T> {
  rows: T[]
  rowCount: number
}

export const db = {
  async query<T = unknown>(
    text: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    // Use `query` rather than `execute` so that integer placeholders for
    // LIMIT / OFFSET work (mysql2's prepared-statement path rejects them with
    // ER_WRONG_ARGUMENTS). `query` keeps `?` placeholders escaped.
    const [rows] = await pool.query(text, params as never) as [T[], unknown]
    return { rows, rowCount: Array.isArray(rows) ? rows.length : 0 }
  },
  async tx<T>(fn: (client: mysql.PoolConnection) => Promise<T>): Promise<T> {
    const conn = await pool.getConnection()
    try {
      await conn.beginTransaction()
      const result = await fn(conn)
      await conn.commit()
      return result
    } catch (err) {
      await conn.rollback()
      throw err
    } finally {
      conn.release()
    }
  },
  pool
}
