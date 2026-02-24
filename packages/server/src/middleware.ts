import type { Request, Response, NextFunction, RequestHandler } from 'express'
import {
  AgentAuthEngine,
  type AgentAuthConfig,
  type InitChallengeOptions,
  type SolveInput,
} from '@xagentauth/core'

export interface GuardOptions {
  minScore?: number
}

export class AgentAuth {
  private engine: AgentAuthEngine

  constructor(config: AgentAuthConfig) {
    this.engine = new AgentAuthEngine(config)
  }

  challenge(): RequestHandler {
    return async (req: Request, res: Response) => {
      try {
        const options: InitChallengeOptions = {
          difficulty: req.body?.difficulty,
          dimensions: req.body?.dimensions,
        }
        const result = await this.engine.initChallenge(options)
        res.status(201).json(result)
      } catch (err) {
        res.status(500).json({
          type: 'https://agentauth.dev/errors/internal',
          title: 'Internal Error',
          status: 500,
          detail: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  }

  retrieve(): RequestHandler {
    return async (req: Request, res: Response) => {
      const id = req.params.id as string
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          type: 'https://agentauth.dev/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing or invalid Authorization header',
        })
        return
      }

      const sessionToken = authHeader.slice(7)
      const challenge = await this.engine.getChallenge(id, sessionToken)

      if (!challenge) {
        res.status(404).json({
          type: 'https://agentauth.dev/errors/not-found',
          title: 'Challenge Not Found',
          status: 404,
          detail: `Challenge ${id} not found or invalid session token`,
        })
        return
      }

      res.json(challenge)
    }
  }

  verify(): RequestHandler {
    return async (req: Request, res: Response) => {
      const id = req.params.id as string
      const input: SolveInput = {
        answer: req.body?.answer,
        hmac: req.body?.hmac,
        canary_responses: req.body?.canary_responses,
        metadata: req.body?.metadata,
      }

      if (!input.answer || !input.hmac) {
        res.status(400).json({
          type: 'https://agentauth.dev/errors/bad-request',
          title: 'Bad Request',
          status: 400,
          detail: 'Missing answer or hmac in request body',
        })
        return
      }

      const result = await this.engine.solveChallenge(id, input)
      res.json(result)
    }
  }

  tokenVerify(): RequestHandler {
    return async (req: Request, res: Response) => {
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ valid: false })
        return
      }

      const token = authHeader.slice(7)
      const result = await this.engine.verifyToken(token)

      if (!result.valid) {
        res.status(401).json(result)
        return
      }

      res.json(result)
    }
  }

  guard(options?: GuardOptions): RequestHandler {
    const minScore = options?.minScore ?? 0.7

    return async (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization
      if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({
          type: 'https://agentauth.dev/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Missing AgentAuth token',
        })
        return
      }

      const token = authHeader.slice(7)
      const result = await this.engine.verifyToken(token)

      if (!result.valid) {
        res.status(401).json({
          type: 'https://agentauth.dev/errors/unauthorized',
          title: 'Unauthorized',
          status: 401,
          detail: 'Invalid or expired AgentAuth token',
        })
        return
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
          res.status(403).json({
            type: 'https://agentauth.dev/errors/insufficient-score',
            title: 'Insufficient Capability Score',
            status: 403,
            detail: `Average score ${avg.toFixed(2)} below minimum ${minScore}`,
          })
          return
        }
      }

      next()
    }
  }
}
