import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcrypt'
import { z } from 'zod'
import { db } from './db'
import type { Role } from '@/types'
import { authConfig } from './auth.config'

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null
        const { email, password } = parsed.data
        const res = await db.query<{
          id: string
          email: string
          username: string
          password_hash: string
          role_name: Role
        }>(
          `SELECT u.id, u.email, u.username, u.password_hash, r.name AS role_name
           FROM users u JOIN roles r ON r.id = u.role_id
           WHERE u.email = ? LIMIT 1`,
          [email]
        )
        const user = res.rows[0]
        if (!user) return null
        const ok = await bcrypt.compare(password, user.password_hash)
        if (!ok) return null
        return { id: user.id, email: user.email, name: user.username, role: user.role_name }
      }
    })
  ]
})

export async function requireAuth() {
  const session = await auth()
  if (!session?.user) throw new Error('UNAUTHORIZED')
  return session
}

export async function requireRole(roles: Role[]) {
  const session = await requireAuth()
  if (!roles.includes(session.user.role)) throw new Error('FORBIDDEN')
  return session
}
