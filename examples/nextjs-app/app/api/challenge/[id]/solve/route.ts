import { NextResponse } from 'next/server'
import { engine } from '../../../../lib/engine'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await request.json().catch(() => ({}))

  if (!body.answer || !body.hmac) {
    return NextResponse.json(
      { error: 'Missing answer or hmac' },
      { status: 400 },
    )
  }

  const result = await engine.solveChallenge(id, {
    answer: body.answer,
    hmac: body.hmac,
    canary_responses: body.canary_responses,
    metadata: body.metadata,
  })

  return NextResponse.json(result)
}
