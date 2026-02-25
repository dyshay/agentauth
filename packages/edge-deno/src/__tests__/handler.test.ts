import { describe, it, expect } from 'vitest'
import { createAgentAuthHandler } from '../handler.js'

const handler = createAgentAuthHandler({ secret: 'test-secret-that-is-at-least-32-chars' })

function makeRequest(method: string, path: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) init.body = JSON.stringify(body)
  return new Request(`http://localhost${path}`, init)
}

describe('createAgentAuthHandler', () => {
  it('returns health check', async () => {
    const res = await handler(makeRequest('GET', '/health'))
    expect(res.status).toBe(200)
    const data = await res.json() as Record<string, unknown>
    expect(data.status).toBe('ok')
    expect(data.runtime).toBe('deno-deploy')
  })

  it('inits a challenge', async () => {
    const res = await handler(makeRequest('POST', '/v1/challenge/init', { difficulty: 'easy' }))
    expect(res.status).toBe(201)
    const data = await res.json() as Record<string, unknown>
    expect(data.id).toBeDefined()
    expect(data.session_token).toBeDefined()
  })

  it('returns 404 for unknown routes', async () => {
    const res = await handler(makeRequest('GET', '/unknown'))
    expect(res.status).toBe(404)
  })

  it('returns 401 for missing auth on challenge retrieval', async () => {
    const res = await handler(makeRequest('GET', '/v1/challenge/test123'))
    expect(res.status).toBe(401)
  })

  it('full challenge flow: init → get', async () => {
    const initRes = await handler(makeRequest('POST', '/v1/challenge/init', { difficulty: 'easy' }))
    const initData = await initRes.json() as { id: string; session_token: string }

    const getReq = new Request(`http://localhost/v1/challenge/${initData.id}`, {
      headers: { Authorization: `Bearer ${initData.session_token}` },
    })
    const getRes = await handler(getReq)
    expect(getRes.status).toBe(200)
    const challenge = await getRes.json() as { payload: { data: string } }
    expect(challenge.payload).toBeDefined()
  })
})
