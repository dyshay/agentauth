import {
  AgentAuthEngine,
  buildHeaders,
  type AgentAuthConfig,
  type InitChallengeOptions,
  type SolveInput,
} from '@xagentauth/core'

/**
 * Minimal Hono-compatible types.
 * Using these instead of importing hono keeps it as an optional peerDependency.
 */
interface HonoContext {
  req: {
    json(): Promise<unknown>
    header(name: string): string | undefined
    param(name: string): string
  }
  json(data: unknown, status?: number): Response
  header(name: string, value: string): void
  status(code: number): void
  next(): Promise<void>
}

type HonoHandler = (c: HonoContext) => Promise<Response | void>

export interface HonoGuardOptions {
  minScore?: number
}

export class AgentAuthHono {
  private engine: AgentAuthEngine

  constructor(config: AgentAuthConfig) {
    this.engine = new AgentAuthEngine(config)
  }

  challenge(): HonoHandler {
    return async (c) => {
      try {
        const body = await c.req.json() as Record<string, unknown>
        const options: InitChallengeOptions = {
          difficulty: body.difficulty as InitChallengeOptions['difficulty'],
          dimensions: body.dimensions as InitChallengeOptions['dimensions'],
        }
        const result = await this.engine.initChallenge(options)
        return c.json(result, 201)
      } catch (err) {
        return c.json({
          type: 'https://agentauth.dev/errors/internal',
          title: 'Internal Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
        }, 500)
      }
    }
  }

  retrieve(): HonoHandler {
    return async (c) => {
      const id = c.req.param('id')
      const authHeader = c.req.header('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({
          type: 'https://agentauth.dev/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing or invalid Authorization header',
        }, 401)
      }

      const sessionToken = authHeader.slice(7)
      const challenge = await this.engine.getChallenge(id, sessionToken)

      if (!challenge) {
        return c.json({
          type: 'https://agentauth.dev/errors/not-found',
          title: 'Challenge Not Found',
          status: 404,
          detail: `Challenge ${id} not found or invalid session token`,
        }, 404)
      }

      return c.json(challenge)
    }
  }

  verify(): HonoHandler {
    return async (c) => {
      const id = c.req.param('id')
      const body = await c.req.json() as Record<string, unknown>
      const input: SolveInput = {
        answer: body.answer as string,
        hmac: body.hmac as string,
        canary_responses: body.canary_responses as Record<string, string> | undefined,
        metadata: body.metadata as { model?: string; framework?: string } | undefined,
      }

      if (!input.answer || !input.hmac) {
        return c.json({
          type: 'https://agentauth.dev/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'Missing answer or hmac in request body',
        }, 400)
      }

      const result = await this.engine.solveChallenge(id, input)

      if (result.success) {
        const agentHeaders = buildHeaders({
          status: 'verified',
          score: result.score,
          model_family: result.model_identity?.family,
          pomi_confidence: result.model_identity?.confidence,
          challenge_id: id,
        })
        for (const [name, value] of Object.entries(agentHeaders)) {
          c.header(name, value)
        }
      }

      return c.json(result)
    }
  }

  tokenVerify(): HonoHandler {
    return async (c) => {
      const authHeader = c.req.header('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({ valid: false }, 401)
      }

      const token = authHeader.slice(7)
      const result = await this.engine.verifyToken(token)
      return c.json(result, result.valid ? 200 : 401)
    }
  }

  guard(options?: HonoGuardOptions): HonoHandler {
    const minScore = options?.minScore ?? 0.7

    return async (c) => {
      const authHeader = c.req.header('authorization')
      if (!authHeader?.startsWith('Bearer ')) {
        return c.json({
          type: 'https://agentauth.dev/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing AgentAuth token',
        }, 401)
      }

      const token = authHeader.slice(7)
      const result = await this.engine.verifyToken(token)

      if (!result.valid) {
        return c.json({
          type: 'https://agentauth.dev/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid or expired AgentAuth token',
        }, 401)
      }

      if (result.capabilities) {
        const avg =
          (result.capabilities.reasoning +
            result.capabilities.execution +
            result.capabilities.autonomy +
            result.capabilities.speed +
            result.capabilities.consistency) /
          5
        if (avg < minScore) {
          return c.json({
            type: 'https://agentauth.dev/errors/insufficient-score',
            title: 'Insufficient Capability Score',
            status: 403,
            detail: `Average score ${avg.toFixed(2)} below minimum ${minScore}`,
          }, 403)
        }
      }

      const agentHeaders = buildHeaders({
        status: 'verified',
        score: result.capabilities,
        model_family: result.model_family,
        expires_at: result.expires_at,
      })
      for (const [name, value] of Object.entries(agentHeaders)) {
        c.header(name, value)
      }

      await c.next()
    }
  }
}
