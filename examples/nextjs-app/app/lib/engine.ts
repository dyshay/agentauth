import { AgentAuthEngine, MemoryStore, CryptoNLDriver } from '@xagentauth/core'

// Shared engine instance across API routes
// In production, use RedisStore or PostgresStore
export const engine = new AgentAuthEngine({
  secret: process.env.AGENTAUTH_SECRET ?? 'dev-secret-at-least-32-bytes-long!!',
  store: new MemoryStore(),
  drivers: [new CryptoNLDriver()],
  pomi: { enabled: false },
  timing: { enabled: false },
})
