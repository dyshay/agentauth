import { describe, it, expect, beforeEach } from 'vitest'
import { AgentAuthHono } from '../hono.js'
import { MemoryStore, CryptoNLDriver, hmacSha256Hex } from '@xagentauth/core'

// Minimal mock of Hono's Context for testing
function createMockContext(overrides: {
  json?: unknown
  header?: string
  param?: string
  headers?: Record<string, string>
}) {
  const responseHeaders: Record<string, string> = {}
  let statusCode = 200

  const ctx = {
    req: {
      json: async () => overrides.json ?? {},
      header: (name: string) => {
        if (name === 'authorization') return overrides.header
        return overrides.headers?.[name]
      },
      param: (_name: string) => overrides.param ?? '',
    },
    json: (data: unknown, status?: number) => {
      statusCode = status ?? 200
      return { data, status: statusCode, headers: responseHeaders } as unknown as Response
    },
    header: (name: string, value: string) => {
      responseHeaders[name] = value
    },
    status: (code: number) => {
      statusCode = code
    },
    next: async () => {},
  }

  return ctx
}

describe('AgentAuthHono', () => {
  let auth: AgentAuthHono
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
    auth = new AgentAuthHono({
      secret: 'test-secret-that-is-at-least-32-bytes-long-for-hs256',
      store,
      drivers: [new CryptoNLDriver()],
    })
  })

  describe('challenge()', () => {
    it('creates a challenge and returns 201', async () => {
      const ctx = createMockContext({ json: { difficulty: 'easy' } })
      const response = await auth.challenge()(ctx as any) as any
      expect(response.status).toBe(201)
      expect(response.data.id).toMatch(/^ch_/)
      expect(response.data.session_token).toMatch(/^st_/)
    })
  })

  describe('retrieve()', () => {
    it('retrieves a challenge with valid session token', async () => {
      // Init first
      const initCtx = createMockContext({ json: { difficulty: 'easy' } })
      const initResponse = await auth.challenge()(initCtx as any) as any
      const { id, session_token } = initResponse.data

      // Retrieve
      const ctx = createMockContext({
        param: id,
        header: `Bearer ${session_token}`,
      })
      const response = await auth.retrieve()(ctx as any) as any
      expect(response.status).toBe(200)
      expect(response.data.id).toBe(id)
      expect(response.data.payload.type).toBe('crypto-nl')
    })

    it('returns 401 without auth header', async () => {
      const ctx = createMockContext({ param: 'ch_123' })
      const response = await auth.retrieve()(ctx as any) as any
      expect(response.status).toBe(401)
    })

    it('returns 404 for wrong session token', async () => {
      const initCtx = createMockContext({ json: { difficulty: 'easy' } })
      const initResponse = await auth.challenge()(initCtx as any) as any

      const ctx = createMockContext({
        param: initResponse.data.id,
        header: 'Bearer st_wrong',
      })
      const response = await auth.retrieve()(ctx as any) as any
      expect(response.status).toBe(404)
    })
  })

  describe('verify()', () => {
    it('verifies a correct answer', async () => {
      // Init
      const initCtx = createMockContext({ json: { difficulty: 'easy' } })
      const initResponse = await auth.challenge()(initCtx as any) as any
      const { id, session_token } = initResponse.data

      // Get stored challenge to solve it
      const stored = await store.get(id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(stored!.challenge.payload)
      const hmac = await hmacSha256Hex(answer, session_token)

      // Solve
      const ctx = createMockContext({
        param: id,
        json: { answer, hmac },
      })
      const response = await auth.verify()(ctx as any) as any
      expect(response.data.success).toBe(true)
      expect(response.data.token).toBeTruthy()
    })

    it('returns 400 without answer', async () => {
      const ctx = createMockContext({ param: 'ch_123', json: {} })
      const response = await auth.verify()(ctx as any) as any
      expect(response.status).toBe(400)
    })
  })

  describe('tokenVerify()', () => {
    it('returns 401 without auth header', async () => {
      const ctx = createMockContext({})
      const response = await auth.tokenVerify()(ctx as any) as any
      expect(response.status).toBe(401)
      expect(response.data.valid).toBe(false)
    })
  })

  describe('guard()', () => {
    it('returns 401 without token', async () => {
      const ctx = createMockContext({})
      const response = await auth.guard()(ctx as any) as any
      expect(response.status).toBe(401)
    })

    it('returns 401 with invalid token', async () => {
      const ctx = createMockContext({ header: 'Bearer invalid.token.here' })
      const response = await auth.guard()(ctx as any) as any
      expect(response.status).toBe(401)
    })
  })
})
