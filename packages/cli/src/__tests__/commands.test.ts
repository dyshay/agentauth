import { describe, it, expect } from 'vitest'
import {
  CryptoNLDriver,
  MultiStepDriver,
  AmbiguousLogicDriver,
  CodeExecutionDriver,
  TokenManager,
} from '@xagentauth/core'

describe('CLI commands logic', () => {
  describe('generate', () => {
    it('generates a crypto-nl challenge', async () => {
      const driver = new CryptoNLDriver()
      const payload = await driver.generate('easy')
      expect(payload.type).toBe('crypto-nl')
      expect(payload.instructions).toBeDefined()
      expect(payload.data).toBeDefined()
    })

    it('generates all challenge types', async () => {
      const drivers = [
        new CryptoNLDriver(),
        new MultiStepDriver(),
        new AmbiguousLogicDriver(),
        new CodeExecutionDriver(),
      ]
      for (const driver of drivers) {
        const payload = await driver.generate('medium')
        expect(payload.type).toBeDefined()
        expect(payload.instructions.length).toBeGreaterThan(0)
      }
    })
  })

  describe('verify', () => {
    it('decodes a valid JWT', async () => {
      const manager = new TokenManager('test-secret-long-enough-32chars!!')
      const token = await manager.sign({
        sub: 'ch_test',
        capabilities: { reasoning: 0.9, execution: 0.95, autonomy: 0.85, speed: 0.9, consistency: 0.92 },
        model_family: 'test-model',
        challenge_ids: ['ch_test'],
      })

      const decoded = manager.decode(token)
      expect(decoded.sub).toBe('ch_test')
      expect(decoded.model_family).toBe('test-model')
      expect(decoded.capabilities).toBeDefined()
    })

    it('verifies signature with correct secret', async () => {
      const secret = 'test-secret-long-enough-32chars!!'
      const manager = new TokenManager(secret)
      const token = await manager.sign({
        sub: 'ch_test',
        capabilities: { reasoning: 0.9, execution: 0.95, autonomy: 0.85, speed: 0.9, consistency: 0.92 },
        model_family: 'test',
        challenge_ids: ['ch_test'],
      })

      const verified = await manager.verify(token)
      expect(verified.sub).toBe('ch_test')
    })
  })

  describe('benchmark', () => {
    it('runs a benchmark round with CryptoNLDriver', async () => {
      const driver = new CryptoNLDriver()
      const payload = await driver.generate('easy')
      const hash = await driver.computeAnswerHash(payload)
      const answer = await (driver as unknown as { solve(p: typeof payload): Promise<string> }).solve(payload)
      const verified = await driver.verify(hash, answer)
      expect(verified).toBe(true)
    })
  })
})
