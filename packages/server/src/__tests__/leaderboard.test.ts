import { describe, it, expect, beforeEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { LeaderboardService } from '../leaderboard.js'
import { MemoryLeaderboardStore } from '../leaderboard-store.js'
import { createLeaderboardRouter } from '../leaderboard-routes.js'

// --- LeaderboardService tests ---

describe('LeaderboardService', () => {
  let store: MemoryLeaderboardStore
  let service: LeaderboardService

  beforeEach(() => {
    store = new MemoryLeaderboardStore()
    service = new LeaderboardService(store)
  })

  it('creates a new entry on first submit', async () => {
    const entry = await service.submit({
      family: 'gpt-4o-class',
      provider: 'OpenAI',
      reasoning: 0.95,
      execution: 0.90,
      autonomy: 0.85,
      speed: 0.80,
      consistency: 0.88,
    })

    expect(entry.family).toBe('gpt-4o-class')
    expect(entry.challenges).toBe(1)
    expect(entry.overall).toBe(0.876)
  })

  it('computes running average on subsequent submits', async () => {
    await service.submit({
      family: 'test-model',
      reasoning: 1.0,
      execution: 1.0,
      autonomy: 1.0,
      speed: 1.0,
      consistency: 1.0,
    })

    const entry = await service.submit({
      family: 'test-model',
      reasoning: 0.5,
      execution: 0.5,
      autonomy: 0.5,
      speed: 0.5,
      consistency: 0.5,
    })

    expect(entry.challenges).toBe(2)
    expect(entry.reasoning).toBe(0.75)
    expect(entry.overall).toBe(0.75)
  })

  it('returns all entries sorted by overall', async () => {
    await service.submit({ family: 'low', reasoning: 0.5, execution: 0.5, autonomy: 0.5, speed: 0.5, consistency: 0.5 })
    await service.submit({ family: 'high', reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9 })

    const all = await service.getAll()
    expect(all[0].family).toBe('high')
    expect(all[1].family).toBe('low')
  })

  it('returns null for unknown family', async () => {
    const entry = await service.getByFamily('nonexistent')
    expect(entry).toBeNull()
  })

  it('returns entry by family', async () => {
    await service.submit({ family: 'test', reasoning: 0.8, execution: 0.8, autonomy: 0.8, speed: 0.8, consistency: 0.8 })
    const entry = await service.getByFamily('test')
    expect(entry).not.toBeNull()
    expect(entry!.family).toBe('test')
  })
})

// --- Leaderboard routes tests ---

describe('Leaderboard Routes', () => {
  let app: ReturnType<typeof express>

  beforeEach(() => {
    app = express()
    app.use(express.json())
    const store = new MemoryLeaderboardStore()
    app.use(createLeaderboardRouter(store))
  })

  it('GET /v1/leaderboard returns empty list initially', async () => {
    const res = await request(app).get('/v1/leaderboard')
    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
    expect(res.body.count).toBe(0)
  })

  it('POST /v1/leaderboard/submit creates entry', async () => {
    const res = await request(app)
      .post('/v1/leaderboard/submit')
      .send({
        family: 'claude-4-class',
        provider: 'Anthropic',
        reasoning: 0.95,
        execution: 0.97,
        autonomy: 0.92,
        speed: 0.90,
        consistency: 0.96,
      })

    expect(res.status).toBe(201)
    expect(res.body.family).toBe('claude-4-class')
    expect(res.body.challenges).toBe(1)
  })

  it('POST /v1/leaderboard/submit rejects incomplete body', async () => {
    const res = await request(app)
      .post('/v1/leaderboard/submit')
      .send({ family: 'test' })

    expect(res.status).toBe(400)
  })

  it('GET /v1/leaderboard/:family returns 404 for unknown', async () => {
    const res = await request(app).get('/v1/leaderboard/nonexistent')
    expect(res.status).toBe(404)
  })

  it('GET /v1/leaderboard/:family returns entry after submit', async () => {
    await request(app)
      .post('/v1/leaderboard/submit')
      .send({
        family: 'gpt-4o',
        provider: 'OpenAI',
        reasoning: 0.9,
        execution: 0.9,
        autonomy: 0.9,
        speed: 0.9,
        consistency: 0.9,
      })

    const res = await request(app).get('/v1/leaderboard/gpt-4o')
    expect(res.status).toBe(200)
    expect(res.body.family).toBe('gpt-4o')
  })

  it('GET /v1/leaderboard returns sorted entries after multiple submits', async () => {
    await request(app).post('/v1/leaderboard/submit').send({
      family: 'low-model',
      reasoning: 0.5, execution: 0.5, autonomy: 0.5, speed: 0.5, consistency: 0.5,
    })
    await request(app).post('/v1/leaderboard/submit').send({
      family: 'high-model',
      reasoning: 0.9, execution: 0.9, autonomy: 0.9, speed: 0.9, consistency: 0.9,
    })

    const res = await request(app).get('/v1/leaderboard')
    expect(res.body.count).toBe(2)
    expect(res.body.entries[0].family).toBe('high-model')
    expect(res.body.entries[1].family).toBe('low-model')
  })
})
