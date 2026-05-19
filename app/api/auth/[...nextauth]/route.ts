import { NextResponse } from 'next/server'

function gone() {
  return NextResponse.json(
    { error: 'NextAuth endpoint removed. Authentication is now handled by Clerk.' },
    { status: 410 }
  )
}

export const GET = gone
export const POST = gone
