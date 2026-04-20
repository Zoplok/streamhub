import mysql from 'mysql2/promise'
import bcrypt from 'bcrypt'
import { randomUUID } from 'node:crypto'

const DB = {
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'Zz11zz211!',
  database: 'streamhub',
  multipleStatements: true
}

interface SeedChannel {
  username: string
  email: string
  channelName: string
  description: string
  role: 'creator' | 'admin'
}

const CHANNELS: SeedChannel[] = [
  { username: 'pixelplays', email: 'pixel@streamhub.dev', channelName: 'PixelPlays', description: 'Daily gaming highlights and streams.', role: 'creator' },
  { username: 'lofi_nova', email: 'lofi@streamhub.dev', channelName: 'Lofi Nova', description: 'Chill beats to code/study to.', role: 'creator' },
  { username: 'techtalk', email: 'tech@streamhub.dev', channelName: 'TechTalk Daily', description: 'Bite-sized tech news and reviews.', role: 'creator' },
  { username: 'fitlife', email: 'fit@streamhub.dev', channelName: 'FitLife Coach', description: 'Workouts, nutrition, mindset.', role: 'creator' },
  { username: 'chefmia', email: 'mia@streamhub.dev', channelName: 'Chef Mia', description: '30-minute recipes made simple.', role: 'creator' },
  { username: 'admin', email: 'admin@streamhub.dev', channelName: 'StreamHub Official', description: 'Announcements & platform news.', role: 'admin' }
]

interface SeedVideo {
  channel: string
  title: string
  description: string
  thumb: string
  duration: number
  views: number
  daysAgo: number
  tags: string[]
}

const THUMB = (seed: string, w = 640, h = 360) =>
  `https://picsum.photos/seed/${encodeURIComponent(seed)}/${w}/${h}`

const VIDEOS: SeedVideo[] = [
  // PixelPlays
  { channel: 'pixelplays', title: 'Elden Ring — First Boss in 3 Minutes', description: 'Speed strat for the first major boss.', thumb: THUMB('elden1'), duration: 642, views: 128_400, daysAgo: 1, tags: ['gaming', 'eldenring', 'souls'] },
  { channel: 'pixelplays', title: 'Valorant Ranked Highlights #42', description: 'Top plays from this week.', thumb: THUMB('valorant1'), duration: 915, views: 54_200, daysAgo: 3, tags: ['gaming', 'valorant', 'fps'] },
  { channel: 'pixelplays', title: 'Minecraft 1.21 — Trial Chambers Guide', description: 'Everything you need to know.', thumb: THUMB('mc1'), duration: 1248, views: 212_000, daysAgo: 7, tags: ['gaming', 'minecraft', 'guide'] },
  { channel: 'pixelplays', title: 'I Beat Dark Souls with a Guitar Controller', description: 'Against all odds.', thumb: THUMB('ds1'), duration: 1860, views: 890_000, daysAgo: 12, tags: ['gaming', 'challenge', 'darksouls'] },

  // Lofi Nova
  { channel: 'lofi_nova', title: 'Midnight Study Beats — 1 Hour Mix', description: 'Focus session with rain.', thumb: THUMB('lofi1'), duration: 3604, views: 1_240_000, daysAgo: 2, tags: ['music', 'lofi', 'study'] },
  { channel: 'lofi_nova', title: 'Coffee Shop Jazz Piano Mix', description: 'Morning vibes.', thumb: THUMB('lofi2'), duration: 2412, views: 320_500, daysAgo: 5, tags: ['music', 'jazz', 'piano'] },
  { channel: 'lofi_nova', title: 'Synthwave Coding Session Vol.3', description: 'Retro vibes for late-night devs.', thumb: THUMB('lofi3'), duration: 3105, views: 488_100, daysAgo: 10, tags: ['music', 'synthwave', 'coding'] },

  // TechTalk
  { channel: 'techtalk', title: 'Apple M4 Max — Is It Worth It?', description: 'Real-world benchmarks.', thumb: THUMB('tech1'), duration: 748, views: 95_300, daysAgo: 1, tags: ['tech', 'apple', 'review'] },
  { channel: 'techtalk', title: 'Next.js 15 — What Actually Changed', description: 'The important bits only.', thumb: THUMB('tech2'), duration: 612, views: 42_800, daysAgo: 4, tags: ['tech', 'nextjs', 'webdev'] },
  { channel: 'techtalk', title: 'Self-Hosting Your Own CDN', description: 'Save thousands with bunny.net + MinIO.', thumb: THUMB('tech3'), duration: 1124, views: 78_900, daysAgo: 9, tags: ['tech', 'devops', 'selfhost'] },

  // FitLife
  { channel: 'fitlife', title: '15-Minute Morning Full Body Workout', description: 'No equipment needed.', thumb: THUMB('fit1'), duration: 900, views: 432_000, daysAgo: 2, tags: ['fitness', 'workout', 'home'] },
  { channel: 'fitlife', title: 'Why You Should Eat More Protein', description: 'The science, simplified.', thumb: THUMB('fit2'), duration: 480, views: 187_400, daysAgo: 6, tags: ['fitness', 'nutrition'] },

  // Chef Mia
  { channel: 'chefmia', title: 'Creamy Garlic Butter Pasta in 12 Min', description: 'Restaurant quality, home easy.', thumb: THUMB('food1'), duration: 720, views: 612_000, daysAgo: 1, tags: ['cooking', 'pasta', 'dinner'] },
  { channel: 'chefmia', title: 'Perfect Ramen Eggs Every Time', description: 'The ajitsuke tamago method.', thumb: THUMB('food2'), duration: 360, views: 298_700, daysAgo: 4, tags: ['cooking', 'ramen', 'japanese'] },
  { channel: 'chefmia', title: 'Sourdough for Absolute Beginners', description: 'No starter? No problem.', thumb: THUMB('food3'), duration: 1320, views: 145_200, daysAgo: 11, tags: ['cooking', 'baking', 'bread'] },

  // Admin / Official
  { channel: 'admin', title: 'Welcome to StreamHub — A Quick Tour', description: 'Everything you can do here.', thumb: THUMB('official1'), duration: 245, views: 12_400, daysAgo: 0, tags: ['announcement', 'platform'] }
]

interface SeedShort {
  channel: string
  title: string
  thumb: string
  duration: number
  views: number
  daysAgo: number
}

const SHORTS: SeedShort[] = [
  { channel: 'pixelplays', title: '😱 This boss took me 47 tries', thumb: THUMB('short1', 360, 640), duration: 38, views: 240_000, daysAgo: 0 },
  { channel: 'pixelplays', title: 'The perfect Valorant clip', thumb: THUMB('short2', 360, 640), duration: 25, views: 188_000, daysAgo: 1 },
  { channel: 'lofi_nova', title: 'Rainy lofi loop 🌧️', thumb: THUMB('short3', 360, 640), duration: 45, views: 520_000, daysAgo: 1 },
  { channel: 'lofi_nova', title: 'Piano vibes at 2am', thumb: THUMB('short4', 360, 640), duration: 52, views: 312_000, daysAgo: 2 },
  { channel: 'techtalk', title: 'One-line trick every dev should know', thumb: THUMB('short5', 360, 640), duration: 31, views: 98_000, daysAgo: 2 },
  { channel: 'techtalk', title: 'Why you should use pnpm', thumb: THUMB('short6', 360, 640), duration: 43, views: 64_200, daysAgo: 3 },
  { channel: 'fitlife', title: '60s abs — no excuses', thumb: THUMB('short7', 360, 640), duration: 60, views: 432_000, daysAgo: 1 },
  { channel: 'fitlife', title: 'Protein shake that actually tastes good', thumb: THUMB('short8', 360, 640), duration: 29, views: 187_400, daysAgo: 4 },
  { channel: 'chefmia', title: 'The only omelet technique you need', thumb: THUMB('short9', 360, 640), duration: 48, views: 780_000, daysAgo: 0 },
  { channel: 'chefmia', title: '10-second ramen hack', thumb: THUMB('short10', 360, 640), duration: 14, views: 1_240_000, daysAgo: 2 }
]

interface SeedLive {
  channel: string
  title: string
  viewers: number
}

const LIVE: SeedLive[] = [
  { channel: 'pixelplays', title: '🔴 LIVE — Elden Ring DLC Blind Run', viewers: 3240 },
  { channel: 'lofi_nova', title: '24/7 Lofi Hip Hop Radio — Beats to Relax/Study', viewers: 1820 },
  { channel: 'techtalk', title: 'LIVE Q&A — Ask Me About Web Dev', viewers: 412 },
  { channel: 'chefmia', title: 'Sunday Brunch Cookalong 🍳', viewers: 987 }
]

async function main() {
  const conn = await mysql.createConnection(DB)
  console.log('Connected to MySQL')

  const defaultHash = await bcrypt.hash('password123', 12)
  const channelIdByUsername = new Map<string, string>()

  console.log('Seeding users + channels…')
  for (const c of CHANNELS) {
    const userId = randomUUID()
    const channelId = randomUUID()

    await conn.execute(
      `INSERT INTO users (id, username, email, password_hash, role_id)
       VALUES (?, ?, ?, ?, (SELECT id FROM roles WHERE name=?))
       ON DUPLICATE KEY UPDATE id = id`,
      [userId, c.username, c.email, defaultHash, c.role]
    )

    // Fetch the real user id (in case of duplicate)
    const [userRows] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM users WHERE username = ? LIMIT 1',
      [c.username]
    )
    const realUserId = (userRows[0] as { id: string }).id

    // Upsert channel for that user
    await conn.execute(
      `INSERT INTO channels (id, user_id, name, description)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE name = VALUES(name), description = VALUES(description)`,
      [channelId, realUserId, c.channelName, c.description]
    )

    const [chRows] = await conn.execute<mysql.RowDataPacket[]>(
      'SELECT id FROM channels WHERE user_id = ? LIMIT 1',
      [realUserId]
    )
    channelIdByUsername.set(c.username, (chRows[0] as { id: string }).id)
  }

  console.log('Seeding videos…')
  for (const v of VIDEOS) {
    const channelId = channelIdByUsername.get(v.channel)
    if (!channelId) continue
    const id = randomUUID()
    const createdAt = new Date(Date.now() - v.daysAgo * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ')

    await conn.execute(
      `INSERT INTO videos (id, channel_id, title, description, hls_url, thumbnail_url, duration, status, views, tags, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'ready', ?, ?, ?)`,
      [
        id,
        channelId,
        v.title,
        v.description,
        'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
        v.thumb,
        v.duration,
        v.views,
        JSON.stringify(v.tags),
        createdAt
      ]
    )
  }

  console.log('Seeding shorts…')
  // Short-form sample clips (royalty-free Big Buck Bunny, Sintel etc.)
  const SAMPLE_CLIPS = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4'
  ]
  for (let i = 0; i < SHORTS.length; i++) {
    const s = SHORTS[i]
    const channelId = channelIdByUsername.get(s.channel)
    if (!channelId) continue
    const id = randomUUID()
    const createdAt = new Date(Date.now() - s.daysAgo * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 19).replace('T', ' ')
    await conn.execute(
      `INSERT INTO shorts (id, channel_id, title, video_url, thumbnail_url, duration, views, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        channelId,
        s.title,
        SAMPLE_CLIPS[i % SAMPLE_CLIPS.length],
        s.thumb,
        s.duration,
        s.views,
        createdAt
      ]
    )
  }

  console.log('Seeding live streams…')
  for (const l of LIVE) {
    const channelId = channelIdByUsername.get(l.channel)
    if (!channelId) continue
    const id = randomUUID()
    const streamKey = `sk_${randomUUID().replace(/-/g, '').slice(0, 20)}`
    await conn.execute(
      `INSERT INTO live_streams (id, channel_id, title, stream_key, status, viewer_count, hls_url, started_at)
       VALUES (?, ?, ?, ?, 'live', ?, ?, CURRENT_TIMESTAMP)`,
      [
        id,
        channelId,
        l.title,
        streamKey,
        l.viewers,
        'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
      ]
    )
  }

  console.log('✓ Seed complete')
  console.log('  Login with any seeded user (password: password123)')
  console.log('  Admin: admin@streamhub.dev / password123')

  await conn.end()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
