import { auth as clerkAuth, clerkClient, currentUser, verifyToken } from '@clerk/nextjs/server'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from './db'
import type { Role, Session } from '@/types'

type DbUserRow = {
  id: string
  email: string
  username: string
  role_name: Role
  avatar_url: string | null
}

const DEFAULT_ROLE: Role = 'viewer'

function normalizeUsername(raw: string) {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/^[-_]+/, '')

  if (cleaned.length >= 3) return cleaned.slice(0, 32)
  if (cleaned.length > 0) return `user_${cleaned}`.slice(0, 32)
  return `user_${randomUUID().replace(/-/g, '').slice(0, 8)}`
}

function buildUsernameSeed(name: string | null | undefined, email: string) {
  if (name?.trim()) return name
  const localPart = email.split('@')[0] ?? ''
  return localPart || 'user'
}

function buildUniqueUsername(name: string | null | undefined, email: string) {
  const base = normalizeUsername(buildUsernameSeed(name, email))
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6)
  const maxBaseLength = Math.max(3, 32 - suffix.length - 1)
  const safeBase = base.slice(0, maxBaseLength)
  return `${safeBase}_${suffix}`
}

async function findUserByEmail(email: string) {
  const res = await db.query<DbUserRow>(
    `SELECT u.id, u.email, u.username, r.name AS role_name,
            COALESCE(c.avatar_url, u.avatar_url) AS avatar_url
     FROM users u JOIN roles r ON r.id = u.role_id
     LEFT JOIN channels c ON c.user_id = u.id
     WHERE u.email = ? LIMIT 1`,
    [email]
  )
  return res.rows[0] ?? null
}

async function createUserFromIdentity(email: string, name: string | null | undefined, image: string | null | undefined) {
  const id = randomUUID()
  const username = buildUniqueUsername(name, email)
  const passwordHash = await bcrypt.hash(randomUUID(), 12)

  await db.query(
    `INSERT INTO users (id, username, email, password_hash, role_id, avatar_url)
     VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name=?), ?)`,
    [id, username, email, passwordHash, DEFAULT_ROLE, image ?? null]
  )

  return {
    id,
    email,
    username,
    role_name: DEFAULT_ROLE,
    avatar_url: image ?? null
  } satisfies DbUserRow
}

function claimAsString(claims: unknown, keys: string[]) {
  if (!claims || typeof claims !== 'object') return null
  const map = claims as Record<string, unknown>
  for (const key of keys) {
    const value = map[key]
    if (typeof value === 'string' && value.trim()) return value
  }
  return null
}

async function resolveDbUserFromSessionTokenCookie() {
  if (!process.env.CLERK_SECRET_KEY) return null

  try {
    const cookieStore = await cookies()
    const exactSession = cookieStore.get('__session')?.value
    const suffixedSession = cookieStore.getAll().find((c) => c.name.startsWith('__session_'))?.value
    const sessionToken = exactSession ?? suffixedSession
    if (!sessionToken) return null

    const payload = await verifyToken(sessionToken, { secretKey: process.env.CLERK_SECRET_KEY })
    const clerkUserId = typeof payload?.sub === 'string' ? payload.sub : null
    if (!clerkUserId) return null

    const user = await (await clerkClient()).users.getUser(clerkUserId)
    const email =
      user.primaryEmailAddress?.emailAddress ??
      user.emailAddresses?.[0]?.emailAddress ??
      null
    if (!email) return null

    const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
    const name = user.fullName ?? user.username ?? fullName
    const image = user.imageUrl ?? null

    const existing = await findUserByEmail(email)
    if (existing) {
      if (image && !existing.avatar_url) {
        await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [image, existing.id])
        return { ...existing, avatar_url: image }
      }
      return existing
    }

    return createUserFromIdentity(email, name, image)
  } catch {
    return null
  }
}

async function resolveDbUserFromClerk() {
  let authState: Awaited<ReturnType<typeof clerkAuth>>
  try {
    authState = await clerkAuth()
  } catch {
    const fallback = await resolveDbUserFromSessionTokenCookie()
    return fallback
  }
  if (!authState.userId) {
    const fallback = await resolveDbUserFromSessionTokenCookie()
    return fallback
  }

  let email = claimAsString(authState.sessionClaims, ['email', 'primaryEmail', 'email_address'])
  let name = claimAsString(authState.sessionClaims, ['fullName', 'name'])
  let image = claimAsString(authState.sessionClaims, ['picture', 'image', 'avatar'])

  if (!email || !name || !image) {
    let user = null
    try {
      user = await currentUser()
    } catch {
      user = null
    }
    if (user) {
      const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || null
      email = email ?? user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null
      name = name ?? user.fullName ?? user.username ?? fullName
      image = image ?? user.imageUrl ?? null
    }
  }

  if (!email) return null

  const existing = await findUserByEmail(email)
  if (existing) {
    if (image && !existing.avatar_url) {
      await db.query('UPDATE users SET avatar_url = ? WHERE id = ?', [image, existing.id])
      return { ...existing, avatar_url: image }
    }
    return existing
  }

  return createUserFromIdentity(email, name, image)
}

export async function auth(): Promise<Session | null> {
  const user = await resolveDbUserFromClerk()
  if (!user) return null

  return {
    user: {
      id: user.id,
      role: user.role_name,
      name: user.username,
      email: user.email,
      image: user.avatar_url
    }
  }
}

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
