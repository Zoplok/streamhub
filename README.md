# StreamHub

A production-grade video streaming platform combining YouTube-style video hosting, Twitch-style live streaming, and short-form vertical video (Shorts).

## Stack

- Next.js 14 (App Router) - unified frontend + backend
- MySQL via `mysql2` (raw parameterized SQL)
- NextAuth.js v5 (JWT + credentials)
- Socket.io (custom Node server in `server.ts`)
- FFmpeg HLS transcode pipeline
- S3-compatible storage (MinIO locally)
- OpenAI function-calling agent (`lib/ai/`)
- Tailwind CSS
- Docker + docker-compose

## Quick start

```bash
cp .env.example .env
docker compose up -d mysql
npm install
npm run migrate
npm run dev
```

App runs at http://localhost:3000, Socket.io at `/api/socket`.

MinIO console: http://localhost:9001 (create a public bucket named `streamhub`).

### Full stack in docker

```bash
docker compose up --build
```

## Project layout

- `app/` - App Router pages & route handlers
  - `app/api/**/route.ts` - all backend routes (auth, videos, shorts, streams, channels, admin, ai)
  - `app/(public)/` - unauthenticated pages
  - `app/(protected)/` - auth-required pages (guarded by `middleware.ts`)
- `components/` - Server + Client components (ui, video, shorts, live, channel, admin)
- `lib/` - db, auth, s3, ffmpeg, socket, queue, ai
- `scripts/schema.sql` - database schema (roles, users, channels, videos, shorts, live_streams, subscriptions, comments, reactions, watch_history, chat_messages, reports)
- `middleware.ts` - role-based route protection (admin / moderator / creator / viewer)
- `server.ts` - custom Node server that attaches Socket.io

## Key flows

### Video upload -> HLS
1. `POST /api/videos` (multipart) stores the original in S3 and enqueues a transcode job (`lib/queue.ts`).
2. `lib/ffmpeg.ts` produces an HLS master playlist (360p / 720p / 1080p) + a thumbnail; all segments are uploaded to S3.
3. DB row flips `status='ready'` with `hls_url` + `thumbnail_url` populated.
4. `/watch/[id]` streams via `hls.js` in a Client Component.

### Live streaming
1. Creator calls `POST /api/streams` -> receives RTMP URL + stream key.
2. Encoder pushes RTMP to an ingest server (external). When HLS playlist is available, `PATCH /api/streams/[id]` marks `status='live'` with `hls_url`.
3. Socket.io (`lib/socket.ts`) drives real-time chat and viewer count via `stream:join`, `chat:send`, `chat:message`, `stream:viewers`.

### Shorts feed
- Score = `views * 0.3 + likes * 0.5 + recency * 0.2`.
- `/api/shorts/feed` returns a cursor-paginated slice ordered by score.
- `ShortsPlayer` uses IntersectionObserver to autoplay the visible clip and a sentinel to load more.

### AI agent
- `lib/ai/tools.ts` - 5 tool definitions (JSON schema).
- `lib/ai/handlers.ts` - real DB-backed executors; enforces role-based restrictions (e.g. only admin/moderator can call `moderate_comment`).
- `lib/ai/agent.ts` - tool-calling loop (max 5 turns).
- Routes: `/api/ai/search`, `/api/ai/recommend`, `/api/ai/moderate`, `/api/ai/suggest-tags`.

### Role-based access
`middleware.ts` matches `/dashboard`, `/upload`, `/go-live`, `/admin`. Redirects unauthenticated users to `/login` and non-admins away from `/admin`. API routes additionally verify with `auth()` and role checks.

## Security notes

- All DB queries use parameterized `?` syntax.
- Passwords hashed with bcrypt (cost 12).
- Comment/chat input sanitized (strips `<` and `>`).
- httpOnly cookies (NextAuth default).
- Zod validation on every API input.

## Seeding a test admin

```sql
INSERT INTO users (id, username, email, password_hash, role_id)
VALUES (
  UUID(),
  'admin',
  'admin@local',
  -- bcrypt hash for 'password123' (cost 12)
  '$2b$12$KIXo8XkHq2e0Q9e9F9qf2uE5oP2y1FZJjq6p8rA8nC6T5v6H8W0qK',
  (SELECT id FROM roles WHERE name='admin')
);
```

**Environment variables:**
- `DB_HOST` - MySQL host (default: localhost)
- `DB_PORT` - MySQL port (default: 3306)
- `DB_USER` - MySQL user (default: root)
- `DB_PASSWORD` - MySQL password
- `DB_NAME` - MySQL database name (default: streamhub)

Replace the hash with one generated locally via `node -e "console.log(require('bcrypt').hashSync('yourpassword',12))"`.
