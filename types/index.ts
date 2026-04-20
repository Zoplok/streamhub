import type { DefaultSession } from 'next-auth'

export type Role = 'admin' | 'moderator' | 'creator' | 'viewer'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: Role
    } & DefaultSession['user']
  }
  // `id` is already declared as optional on next-auth's default User interface,
  // so we only augment with our app-specific fields. Re-declaring `id` with a
  // different modifier breaks tsc ("identical modifiers" error).
  interface User {
    role: Role
  }
}

declare module 'next-auth' {
  interface JWT {
    sub: string
    role: Role
  }
}

export interface User {
  id: string
  username: string
  email: string
  role: Role
  avatar_url: string | null
  created_at: string
}

export interface Channel {
  id: string
  user_id: string
  name: string
  description: string | null
  banner_url: string | null
  created_at: string
}

export interface Video {
  id: string
  channel_id: string
  title: string
  description: string | null
  hls_url: string | null
  thumbnail_url: string | null
  duration: number
  status: 'processing' | 'ready' | 'failed'
  views: number
  created_at: string
}

export interface Short {
  id: string
  channel_id: string
  title: string
  video_url: string
  thumbnail_url: string | null
  duration: number
  views: number
  created_at: string
}

export interface LiveStream {
  id: string
  channel_id: string
  title: string
  stream_key: string
  status: 'idle' | 'live' | 'ended'
  viewer_count: number
  started_at: string | null
  ended_at: string | null
}

export interface Comment {
  id: string
  user_id: string
  video_id: string | null
  short_id: string | null
  parent_id: string | null
  content: string
  created_at: string
  username?: string
  avatar_url?: string | null
  replies?: Comment[]
}

export interface Report {
  id: string
  reporter_id: string
  target_type: 'video' | 'short' | 'comment' | 'user' | 'stream'
  target_id: string
  reason: string
  status: 'pending' | 'resolved' | 'dismissed'
  created_at: string
}

export interface ChatMessage {
  id: string
  stream_id: string
  user_id: string
  username: string
  content: string
  created_at: string
}

export interface ApiError { error: string | Record<string, unknown> }
export interface ApiData<T> { data: T }
