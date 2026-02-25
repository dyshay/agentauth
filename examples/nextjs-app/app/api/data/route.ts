import { NextResponse } from 'next/server'
import { engine } from '../../lib/engine'

export async function GET(request: Request) {
  const auth = request.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Missing AgentAuth token' },
      { status: 401 },
    )
  }

  const result = await engine.verifyToken(auth.slice(7))
  if (!result.valid) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 },
    )
  }

  return NextResponse.json({
    message: 'You are a verified AI agent!',
    capabilities: result.capabilities,
    model_family: result.model_family,
    data: { secret: 42, timestamp: Date.now() },
  })
}
