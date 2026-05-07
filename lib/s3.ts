import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

export const s3 = new S3Client({
  region: process.env.S3_REGION ?? 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!
  }
})

export const S3_BUCKET = process.env.S3_BUCKET ?? 'streamhub'
export const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL ?? `${process.env.S3_ENDPOINT}/${S3_BUCKET}`
const storageDriver = process.env.STORAGE_DRIVER ?? (process.env.NODE_ENV === 'production' ? 's3' : 'local')
const localUploadRoot = path.join(process.cwd(), 'public', 'uploads')
const localPublicBase = process.env.LOCAL_STORAGE_PUBLIC_URL ?? '/uploads'

export function hasPersistentObjectStorage() {
  if (storageDriver === 'local') return process.env.NODE_ENV !== 'production'
  return Boolean(
    process.env.S3_ENDPOINT &&
    process.env.S3_BUCKET &&
    process.env.S3_ACCESS_KEY &&
    process.env.S3_SECRET_KEY
  )
}

async function toBuffer(body: Buffer | Uint8Array | Readable) {
  if (Buffer.isBuffer(body)) return body
  if (body instanceof Uint8Array) return Buffer.from(body)
  const chunks: Buffer[] = []
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks)
}

function normalizeKey(key: string) {
  return key.replace(/\\/g, '/').replace(/^\/+/, '')
}

function localPath(key: string) {
  return path.join(localUploadRoot, normalizeKey(key))
}

export async function uploadObject(key: string, body: Buffer | Uint8Array | Readable, contentType: string) {
  if (storageDriver === 'local') {
    const target = localPath(key)
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, await toBuffer(body))
    return publicUrl(key)
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read'
    })
  )
  return publicUrl(key)
}

export async function deleteObject(key: string) {
  if (storageDriver === 'local') {
    await rm(localPath(key), { force: true }).catch(() => {})
    return
  }
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}

export function publicUrl(key: string) {
  if (storageDriver === 'local') {
    return `${localPublicBase.replace(/\/$/, '')}/${normalizeKey(key)}`
  }
  return `${S3_PUBLIC_URL}/${key}`
}

export async function presignGet(key: string, expiresIn = 3600) {
  if (storageDriver === 'local') return publicUrl(key)
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn })
}

export async function presignPut(key: string, contentType: string, expiresIn = 3600) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn
  })
}
