import { NextResponse } from 'next/server'
import { AgentAuthEngine, MemoryStore } from '@xagentauth/core'
import { CryptoNLDriver } from '@xagentauth/core'

// Shared engine instance (in production, use Redis store)
const engine = new AgentAuthEngine({
  secret: process.env.AGENTAUTH_SECRET ?? 'dev-secret-at-least-32-bytes-long!!',
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
})

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}))
  const result = await engine.initChallenge({
    difficulty: body.difficulty ?? 'medium',
    dimensions: body.dimensions,
  })
  return NextResponse.json(result, { status: 201 })
}

// Export engine for use in other routes
export { engine }
