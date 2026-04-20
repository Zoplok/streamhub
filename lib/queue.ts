import { unlink } from 'node:fs/promises'
import { db } from './db'
import { transcodeToHls } from './ffmpeg'
import { notifyChannelSubscribers } from './notifications'

interface TranscodeJob {
  videoId: string
  inputPath: string
}

const queue: TranscodeJob[] = []
let running = false

export function enqueueTranscode(job: TranscodeJob) {
  queue.push(job)
  void drain()
}

async function drain() {
  if (running) return
  running = true
  try {
    while (queue.length) {
      const job = queue.shift()!
      try {
        const { hlsUrl, thumbnailUrl, duration } = await transcodeToHls(job.inputPath, job.videoId)
        await db.query(
          `UPDATE videos SET hls_url=?, thumbnail_url=?, duration=?, status='ready'
           WHERE id=?`,
          [hlsUrl, thumbnailUrl, duration, job.videoId]
        )
        // Fan out a notification to every subscriber of the channel.
        try {
          const info = await db.query<{ channel_id: string; title: string; channel_name: string; user_id: string }>(
            `SELECT v.channel_id, v.title, c.name AS channel_name, c.user_id
             FROM videos v JOIN channels c ON c.id = v.channel_id
             WHERE v.id = ? LIMIT 1`,
            [job.videoId]
          )
          const r = info.rows[0]
          if (r) {
            await notifyChannelSubscribers(r.channel_id, {
              actorId: r.user_id,
              type: 'new_video',
              title: `${r.channel_name} uploaded a new video`,
              body: r.title,
              link: `/watch/${job.videoId}`,
              thumbnail: thumbnailUrl
            })
          }
        } catch (e) {
          console.error('[notify new_video]', e)
        }
      } catch (err) {
        console.error('transcode failed', job.videoId, err)
        await db
          .query("UPDATE videos SET status='failed' WHERE id=?", [job.videoId])
          .catch(() => {})
      } finally {
        await unlink(job.inputPath).catch(() => {})
      }
    }
  } finally {
    running = false
  }
}
