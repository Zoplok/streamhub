# StreamHub

A production-grade video streaming platform combining YouTube-style video hosting, Twitch-style live streaming, and short-form vertical video (Shorts).

## Stack

- Next.js 14 (App Router) - unified frontend + backend
- MySQL via `mysql2` (raw parameterized SQL)
- NextAuth.js v5 (JWT + credentials)
- Socket.io (custom Node server in `server.ts`)
- FFmpeg HLS transcode pipeline
- S3-compatible storage, with local filesystem uploads by default in development
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

App runs at http://127.0.0.1:3002, Socket.io at `/api/socket`.

Local development stores uploaded videos under `public/uploads` by default. To use MinIO/S3 instead, set `STORAGE_DRIVER=s3` and configure the `S3_*` environment variables.

### Full stack in docker

```bash
docker compose up --build
```

### Vercel deployment

Vercel can host the Next.js pages and route handlers, but it will not run the custom Node server in `server.ts`. That means these features need an external service if you deploy the web app on Vercel:

- Socket.io chat and live viewer counts (`/api/socket`)
- Browser WebSocket ingest (`/api/ws/stream`)
- FFmpeg background transcodes (`lib/queue.ts` / `lib/ffmpeg.ts`)
- RTMP ingest and HLS packaging (`nginx-rtmp`)
- MySQL, Redis, and file storage containers

Use Vercel for the web/API app, and run the realtime/ingest worker stack on a VM or container host. For Vercel, configure:

```bash
NEXTAUTH_URL=https://your-vercel-domain.vercel.app
NEXTAUTH_SECRET=<generated-secret>
DB_HOST=<external-mysql-host>
DB_PORT=3306
DB_USER=<external-mysql-user>
DB_PASSWORD=<external-mysql-password>
DB_NAME=streamhub
STORAGE_DRIVER=s3
S3_ENDPOINT=<s3-compatible-endpoint>
S3_REGION=<region>
S3_BUCKET=<bucket>
S3_ACCESS_KEY=<access-key>
S3_SECRET_KEY=<secret-key>
S3_PUBLIC_URL=<public-bucket-url>
REDIS_URL=<external-redis-url>
OPENAI_API_KEY=<provider-key>
OPENAI_BASE_URL=<provider-url-if-not-openai>
OPENAI_MODEL=<model>
HLS_PUBLIC_URL=<external-hls-base-url>
RTMP_INGEST_URL=<external-rtmp-url>
NEXT_PUBLIC_RTMP_INGEST_URL=<public-rtmp-url-for-obs>
NEXT_PUBLIC_INGEST_WS_URL=<public-wss-url-for-browser-go-live>
```

`RTMP_INGEST_URL` is server-side and is used by FFmpeg. `NEXT_PUBLIC_RTMP_INGEST_URL`
is safe to show in Studio because creators still need their private stream key.
`NEXT_PUBLIC_INGEST_WS_URL` should point at a long-running ingest host that serves
the `/api/ws/stream` WebSocket route; do not point it at Vercel.

### External ingest host

To make live video work with a Vercel-hosted web app, run the ingest stack on a
VPS or container host that supports long-running WebSockets and public TCP port
1935:

```bash
cp .env.ingest.example .env.ingest
# edit .env.ingest with DATABASE_URL, NEXTAUTH_SECRET, and HLS_PUBLIC_URL
docker compose -f docker-compose.ingest.yml up --build -d
```

Open these ports on the host:

- `3002` for browser WebSocket ingest at `/api/ws/stream`
- `1935` for OBS RTMP ingest
- `8080` for HLS playback at `/hls/<stream_id>.m3u8`

After the host is reachable, sync its public URLs into Vercel:

```powershell
.\scripts\configure-vercel-ingest.ps1 -HostName ingest.example.com
vercel --prod --yes
```

Run migrations against the external database before first use:

```bash
npm run db:migrate
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
1. `POST /api/videos` (multipart) stores the original in local storage or S3 and enqueues a transcode job (`lib/queue.ts`).
2. `lib/ffmpeg.ts` produces an HLS master playlist (360p / 720p / 1080p) + a thumbnail; all segments are uploaded to the configured storage driver.
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
