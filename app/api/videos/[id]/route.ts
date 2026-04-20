import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const idSchema = z.string().uuid()

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    const result = await db.query(
      `SELECT v.*, c.name AS channel_name, c.user_id AS channel_owner_id,
              (SELECT CAST(COUNT(*) AS SIGNED) FROM reactions r WHERE r.target_type='video' AND r.target_id=v.id AND r.type='like') AS likes,
              (SELECT CAST(COUNT(*) AS SIGNED) FROM reactions r WHERE r.target_type='video' AND r.target_id=v.id AND r.type='dislike') AS dislikes
       FROM videos v JOIN channels c ON c.id = v.channel_id
       WHERE v.id=?`,
      [params.id]
    )
    if (!result.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    await db.query('UPDATE videos SET views = views + 1 WHERE id=?', [params.id])
    return NextResponse.json({ data: result.rows[0] })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  tags: z.array(z.string().max(40)).max(20).optional()
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }

  const body = await req.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  try {
    const owner = await db.query<{ user_id: string }>(
      `SELECT c.user_id FROM videos v JOIN channels c ON c.id=v.channel_id WHERE v.id=?`,
      [params.id]
    )
    if (!owner.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (owner.rows[0].user_id !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const fields: string[] = []
    const values: unknown[] = []
    if (parsed.data.title !== undefined) {
      values.push(parsed.data.title)
      fields.push(`title=?`)
    }
    if (parsed.data.description !== undefined) {
      values.push(parsed.data.description)
      fields.push(`description=?`)
    }
    if (parsed.data.tags !== undefined) {
      values.push(JSON.stringify(parsed.data.tags))
      fields.push(`tags=CAST(? AS JSON)`)
    }
    if (!fields.length) return NextResponse.json({ data: null })
    values.push(params.id)
    fields.push(`id=?`)
    await db.query(`UPDATE videos SET ${fields.join(', ')} WHERE id=?`, values)
    return NextResponse.json({ data: { id: params.id } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!idSchema.safeParse(params.id).success) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  try {
    const owner = await db.query<{ user_id: string }>(
      `SELECT c.user_id FROM videos v JOIN channels c ON c.id=v.channel_id WHERE v.id=?`,
      [params.id]
    )
    if (!owner.rows[0]) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    if (owner.rows[0].user_id !== session.user.id && session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    await db.query('DELETE FROM videos WHERE id=?', [params.id])
    return NextResponse.json({ data: { deleted: true } })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
