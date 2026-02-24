import { describe, it, expect } from 'vitest'
import { CryptoNLDriver } from '../challenges/crypto-nl.js'
import { fromHex } from '../crypto.js'

describe('CryptoNLDriver', () => {
  const driver = new CryptoNLDriver()

  it('has correct metadata', () => {
    expect(driver.name).toBe('crypto-nl')
    expect(driver.dimensions).toContain('reasoning')
    expect(driver.dimensions).toContain('execution')
  })

  it('generates a challenge payload', async () => {
    const payload = await driver.generate('easy')
    expect(payload.type).toBe('crypto-nl')
    expect(payload.instructions).toBeTruthy()
    expect(payload.data).toBeTruthy()
    expect(payload.steps).toBeGreaterThanOrEqual(1)
  })

  it('generates different challenges each time', async () => {
    const a = await driver.generate('medium')
    const b = await driver.generate('medium')
    expect(a.data).not.toBe(b.data)
  })

  it('generates solvable challenges — easy', async () => {
    const payload = await driver.generate('easy')
    const answer = await driver.solve(payload)
    expect(answer).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex
  })

  it('verifies correct answer', async () => {
    const payload = await driver.generate('easy')
    const answer = await driver.solve(payload)
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('rejects wrong answer', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, 'wrong')).toBe(false)
  })

  it('scales operations with difficulty', async () => {
    const easy = await driver.generate('easy')
    const hard = await driver.generate('hard')
    // Hard challenges have more operation steps encoded in instructions
    expect(hard.instructions.length).toBeGreaterThan(easy.instructions.length)
  })
})
