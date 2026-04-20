import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
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

export async function uploadObject(key: string, body: Buffer | Uint8Array | Readable, contentType: string) {
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
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }))
}

export function publicUrl(key: string) {
  return `${S3_PUBLIC_URL}/${key}`
}

export async function presignGet(key: string, expiresIn = 3600) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn })
}

export async function presignPut(key: string, contentType: string, expiresIn = 3600) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }), {
    expiresIn
  })
}
