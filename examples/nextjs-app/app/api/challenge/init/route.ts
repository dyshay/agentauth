import { NextResponse } from 'next/server'
import { engine } from '../../../lib/engine'

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const result = await engine.initChallenge({
    difficulty: body.difficulty ?? 'medium',
    dimensions: body.dimensions,
  })
  return NextResponse.json(result, { status: 201 })
}
