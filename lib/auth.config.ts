import type { NextAuthConfig } from 'next-auth'
import type { Role } from '@/types'

// Edge-safe config (no DB, no bcrypt). Used by middleware.
export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = (user as { id: string }).id
        token.role = (user as { role: Role }).role
        token.picture = user.image ?? null
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!
        session.user.role = token.role as Role
        session.user.image = typeof token.picture === 'string' ? token.picture : null
      }
      return session
    },
    authorized({ auth }) {
      return !!auth
    }
  }
}
