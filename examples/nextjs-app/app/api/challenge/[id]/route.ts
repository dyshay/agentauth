import { NextResponse } from 'next/server'
import { engine } from '../../../lib/engine'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    )
  }

  const challenge = await engine.getChallenge(id, auth.slice(7))
  if (!challenge) {
    return NextResponse.json(
      { error: 'Challenge not found' },
      { status: 404 },
    )
  }

  return NextResponse.json(challenge)
}
