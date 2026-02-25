import { Router, type Request, type Response } from 'express'
import { LeaderboardService, type SubmitScoreInput } from './leaderboard.js'
import type { LeaderboardStore } from './leaderboard-store.js'

export function createLeaderboardRouter(store: LeaderboardStore): Router {
  const router = Router()
  const service = new LeaderboardService(store)

  // GET /v1/leaderboard — all entries sorted by overall
  router.get('/v1/leaderboard', async (_req: Request, res: Response) => {
    const entries = await service.getAll()
    res.json({ entries, count: entries.length })
  })

  // GET /v1/leaderboard/:family — single model family
  router.get('/v1/leaderboard/:family', async (req: Request, res: Response) => {
    const family = req.params.family as string
    const entry = await service.getByFamily(family)

    if (!entry) {
      res.status(404).json({
        type: 'https://agentauth.dev/errors/not-found',
        title: 'Not Found',
        status: 404,
        detail: `Model family '${family}' not found on leaderboard`,
      })
      return
    }

    res.json(entry)
  })

  // POST /v1/leaderboard/submit — submit a score
  router.post('/v1/leaderboard/submit', async (req: Request, res: Response) => {
    const body = req.body as Partial<SubmitScoreInput>

    if (!body.family || body.reasoning == null || body.execution == null ||
        body.autonomy == null || body.speed == null || body.consistency == null) {
      res.status(400).json({
        type: 'https://agentauth.dev/errors/bad-request',
        title: 'Bad Request',
        status: 400,
        detail: 'Missing required fields: family, reasoning, execution, autonomy, speed, consistency',
      })
      return
    }

    const entry = await service.submit({
      family: body.family,
      provider: body.provider,
      reasoning: body.reasoning,
      execution: body.execution,
      autonomy: body.autonomy,
      speed: body.speed,
      consistency: body.consistency,
    })

    res.status(201).json(entry)
  })

  return router
}
