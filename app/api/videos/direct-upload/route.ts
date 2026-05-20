import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { canPresignObjectUploads, presignPut, publicUrl } from '@/lib/s3'

export const runtime = 'nodejs'

const MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024

const schema = z.object({
  fileName: z.string().min(1).max(255),
  contentType: z.string().min(1).max(100).default('video/mp4'),
  fileSize: z.number().int().positive().max(MAX_FILE_BYTES)
})

function extensionFromName(fileName: string) {
  return (fileName.split('.').pop() ?? 'mp4').replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 5) || 'mp4'
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!['admin', 'creator'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (!canPresignObjectUploads()) {
    return NextResponse.json(
      { error: 'Direct uploads require S3/R2 storage. Configure STORAGE_DRIVER=s3 and S3_* environment variables.' },
      { status: 409 }
    )
  }

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const videoId = randomUUID()
  const contentType = parsed.data.contentType || 'video/mp4'
  const key = `originals/${videoId}.${extensionFromName(parsed.data.fileName)}`
  const uploadUrl = await presignPut(key, contentType, 60 * 30)

  return NextResponse.json({
    data: {
      id: videoId,
      key,
      uploadUrl,
      publicUrl: publicUrl(key),
      headers: { 'Content-Type': contentType }
    }
  })
}
