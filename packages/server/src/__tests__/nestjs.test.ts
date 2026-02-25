import 'reflect-metadata'
import { describe, it, expect, beforeEach } from 'vitest'
import { AgentAuthService, AgentAuthGuard, AgentAuthModule, AgentAuth, AGENTAUTH_MIN_SCORE_KEY } from '../nestjs.js'
import { MemoryStore, CryptoNLDriver, hmacSha256Hex } from '@xagentauth/core'
import type { AgentAuthConfig } from '@xagentauth/core'

// ---------------------------------------------------------------------------
// Mock helpers for NestJS ExecutionContext
// ---------------------------------------------------------------------------

function createMockContext(overrides: {
  authorization?: string
  body?: Record<string, unknown>
  params?: Record<string, string>
}) {
  const responseHeaders: Record<string, string> = {}
  let statusCode = 200
  let responseBody: unknown = undefined

  const res = {
    status(code: number) {
      statusCode = code
      return res
    },
    json(data: unknown) {
      responseBody = data
    },
    setHeader(name: string, value: string) {
      responseHeaders[name] = value
      return res
    },
  }

  const req = {
    headers: {
      authorization: overrides.authorization,
    } as Record<string, string | string[] | undefined>,
    params: overrides.params ?? {},
    body: overrides.body ?? {},
  }

  const executionContext = {
    switchToHttp() {
      return {
        getRequest: <T>() => req as T,
        getResponse: <T>() => res as T,
      }
    },
    getHandler: () => function dummyHandler() {},
    getClass: () => class DummyController {},
  }

  return {
    context: executionContext as any,
    getStatus: () => statusCode,
    getBody: () => responseBody,
    getHeaders: () => responseHeaders,
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const TEST_SECRET = 'test-secret-that-is-at-least-32-bytes-long-for-hs256'

function createConfig(store: InstanceType<typeof MemoryStore>): AgentAuthConfig {
  return {
    secret: TEST_SECRET,
    store,
    drivers: [new CryptoNLDriver()],
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NestJS Adapter', () => {
  let store: MemoryStore
  let config: AgentAuthConfig

  beforeEach(() => {
    store = new MemoryStore()
    config = createConfig(store)
  })

  describe('AgentAuthService', () => {
    it('initChallenge() returns ch_* / st_* IDs', async () => {
      const service = new AgentAuthService(config)
      const result = await service.initChallenge({ difficulty: 'easy' })

      expect(result.id).toMatch(/^ch_/)
      expect(result.session_token).toMatch(/^st_/)
      expect(result.expires_at).toBeGreaterThan(0)
      expect(result.ttl_seconds).toBe(30)
    })

    it('getChallenge() with valid session token returns payload', async () => {
      const service = new AgentAuthService(config)
      const init = await service.initChallenge({ difficulty: 'easy' })
      const challenge = await service.getChallenge(init.id, init.session_token)

      expect(challenge).not.toBeNull()
      expect(challenge!.id).toBe(init.id)
      expect(challenge!.payload.type).toBe('crypto-nl')
    })

    it('getChallenge() with wrong token returns null', async () => {
      const service = new AgentAuthService(config)
      const init = await service.initChallenge({ difficulty: 'easy' })
      const challenge = await service.getChallenge(init.id, 'st_wrong_token')

      expect(challenge).toBeNull()
    })
  })

  describe('AgentAuthGuard', () => {
    it('rejects missing auth header', async () => {
      const service = new AgentAuthService(config)
      const guard = new AgentAuthGuard(service)
      const { context, getStatus, getBody } = createMockContext({})

      const result = await guard.canActivate(context)

      expect(result).toBe(false)
      expect(getStatus()).toBe(401)
      expect((getBody() as any).detail).toContain('Missing AgentAuth token')
    })

    it('rejects invalid token', async () => {
      const service = new AgentAuthService(config)
      const guard = new AgentAuthGuard(service)
      const { context, getStatus, getBody } = createMockContext({
        authorization: 'Bearer invalid.token.here',
      })

      const result = await guard.canActivate(context)

      expect(result).toBe(false)
      expect(getStatus()).toBe(401)
      expect((getBody() as any).detail).toContain('Invalid or expired')
    })

    it('accepts valid token with sufficient score and sets headers', async () => {
      const service = new AgentAuthService(config)
      const guard = new AgentAuthGuard(service)

      // Run full challenge flow to get a valid token
      const init = await service.initChallenge({ difficulty: 'easy' })
      const stored = await store.get(init.id)
      const driver = new CryptoNLDriver()
      const answer = await driver.solve(stored!.challenge.payload)
      const hmac = await hmacSha256Hex(answer, init.session_token)
      const solveResult = await service.solveChallenge(init.id, { answer, hmac })

      expect(solveResult.success).toBe(true)
      expect(solveResult.token).toBeTruthy()

      // Now use the token with the guard
      const { context, getHeaders } = createMockContext({
        authorization: `Bearer ${solveResult.token}`,
      })

      const result = await guard.canActivate(context)

      expect(result).toBe(true)
      const headers = getHeaders()
      expect(headers['AgentAuth-Status']).toBe('verified')
    })
  })

  describe('AgentAuthModule', () => {
    it('forRoot() returns correct module structure', () => {
      const dynamicModule = AgentAuthModule.forRoot(config)

      expect(dynamicModule.module).toBe(AgentAuthModule)
      expect(dynamicModule.providers).toHaveLength(2)
      expect(dynamicModule.exports).toHaveLength(2)
      expect(dynamicModule.exports).toContain(AgentAuthService)
      expect(dynamicModule.exports).toContain(AgentAuthGuard)
    })
  })

  describe('@AgentAuth() decorator', () => {
    it('sets minScore metadata on the handler', () => {
      class TestController {
        @AgentAuth({ minScore: 0.9 })
        handler() {}
      }

      const instance = new TestController()
      const score = Reflect.getMetadata(AGENTAUTH_MIN_SCORE_KEY, instance.handler)
      expect(score).toBe(0.9)
    })
  })
})
