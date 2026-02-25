import {
  AgentAuthEngine,
  buildHeaders,
  MemoryStore,
  CryptoNLDriver,
  MultiStepDriver,
  AmbiguousLogicDriver,
  CodeExecutionDriver,
  type AgentAuthConfig,
  type Difficulty,
  type ChallengeDimension,
} from '@xagentauth/core'
import { json, extractBearer, errorResponse } from './utils.js'

export interface EdgeDenoOptions {
  secret: string
  pomi?: { enabled: boolean }
  timing?: { enabled: boolean }
  drivers?: AgentAuthConfig['drivers']
}

export function createAgentAuthHandler(options: EdgeDenoOptions) {
  const engine = new AgentAuthEngine({
    secret: options.secret,
    store: new MemoryStore(),
    drivers: options.drivers ?? [
      new CryptoNLDriver(),
      new MultiStepDriver(),
      new AmbiguousLogicDriver(),
      new CodeExecutionDriver(),
    ],
    pomi: options.pomi ?? { enabled: true },
    timing: options.timing ?? { enabled: true },
  })

  return async function handler(request: Request): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    if (path === '/health' && method === 'GET') {
      return json({ status: 'ok', runtime: 'deno-deploy' })
    }

    if (path === '/v1/challenge/init' && method === 'POST') {
      try {
        const body = await request.json() as Record<string, unknown>
        const result = await engine.initChallenge({
          difficulty: body.difficulty as Difficulty | undefined,
          dimensions: body.dimensions as ChallengeDimension[] | undefined,
        })
        return json(result, 201)
      } catch (err) {
        return errorResponse(500, 'internal', err)
      }
    }

    const challengeMatch = path.match(/^\/v1\/challenge\/([^/]+)$/)
    if (challengeMatch && method === 'GET') {
      const id = challengeMatch[1]
      const sessionToken = extractBearer(request)
      if (!sessionToken) return errorResponse(401, 'unauthorized', 'Missing Authorization header')

      const challenge = await engine.getChallenge(id, sessionToken)
      if (!challenge) return errorResponse(404, 'not-found', `Challenge ${id} not found`)

      return json(challenge)
    }

    const solveMatch = path.match(/^\/v1\/challenge\/([^/]+)\/solve$/)
    if (solveMatch && method === 'POST') {
      const id = solveMatch[1]
      try {
        const body = await request.json() as Record<string, unknown>
        if (!body.answer || !body.hmac) {
          return errorResponse(400, 'bad-request', 'Missing answer or hmac')
        }

        const result = await engine.solveChallenge(id, {
          answer: body.answer as string,
          hmac: body.hmac as string,
          canary_responses: body.canary_responses as Record<string, string> | undefined,
          metadata: body.metadata as { model?: string; framework?: string } | undefined,
        })

        const headers: Record<string, string> = {}
        if (result.success) {
          const agentHeaders = buildHeaders({
            status: 'verified',
            score: result.score,
            model_family: result.model_identity?.family,
            pomi_confidence: result.model_identity?.confidence,
            challenge_id: id,
          })
          Object.assign(headers, agentHeaders)
        }

        return json(result, 200, headers)
      } catch (err) {
        return errorResponse(500, 'internal', err)
      }
    }

    if (path === '/v1/token/verify' && method === 'GET') {
      const token = extractBearer(request)
      if (!token) return json({ valid: false }, 401)

      const result = await engine.verifyToken(token)
      return json(result, result.valid ? 200 : 401)
    }

    return errorResponse(404, 'not-found', `Route not found: ${method} ${path}`)
  }
}
