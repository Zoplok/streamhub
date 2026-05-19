export type Role = 'admin' | 'moderator' | 'creator' | 'viewer'

export interface SessionUser {
  id: string
  role: Role
  name?: string | null
  email?: string | null
  image?: string | null
}

export interface Session {
  user: SessionUser
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
  description: string | null
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
