import { describe, it, expect } from 'vitest'
import { AmbiguousLogicDriver } from '../challenges/ambiguous-logic.js'
import { sha256Hex } from '../crypto.js'
import type { Difficulty } from '../types.js'

describe('AmbiguousLogicDriver', () => {
  const driver = new AmbiguousLogicDriver()

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  it('has correct metadata', () => {
    expect(driver.name).toBe('ambiguous-logic')
    expect(driver.dimensions).toContain('ambiguity')
    expect(driver.dimensions).toContain('reasoning')
    expect(driver.estimatedHumanTimeMs).toBeGreaterThan(0)
    expect(driver.estimatedAiTimeMs).toBeGreaterThan(0)
  })

  // -----------------------------------------------------------------------
  // Generation
  // -----------------------------------------------------------------------

  it('generates challenge with instructions', async () => {
    const payload = await driver.generate('easy')
    expect(payload.type).toBe('ambiguous-logic')
    expect(payload.instructions).toBeTruthy()
    expect(payload.data).toBeTruthy()
    expect(payload.steps).toBeGreaterThanOrEqual(1)
  })

  it('generates different challenges each time', async () => {
    const a = await driver.generate('medium')
    const b = await driver.generate('medium')
    // Data should differ (random bytes)
    expect(a.data).not.toBe(b.data)
  })

  it('stores scored answers in context', async () => {
    const payload = await driver.generate('easy')
    const ctx = payload.context as {
      primaryAnswer: string
      scoredAnswers: Array<{ answerHash: string; score: number }>
    }
    expect(ctx.primaryAnswer).toBeTruthy()
    expect(ctx.scoredAnswers).toBeInstanceOf(Array)
    expect(ctx.scoredAnswers.length).toBeGreaterThanOrEqual(1)
    // The first scored answer should have score 1.0
    expect(ctx.scoredAnswers[0].score).toBe(1.0)
  })

  // -----------------------------------------------------------------------
  // Primary answer verification
  // -----------------------------------------------------------------------

  it('primary answer verifies correctly', async () => {
    const payload = await driver.generate('easy')
    const answer = await driver.solve(payload)
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Wrong answer rejection
  // -----------------------------------------------------------------------

  it('rejects wrong answer', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, 'deadbeef')).toBe(false)
  })

  it('rejects non-string answer', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, 42)).toBe(false)
    expect(await driver.verify(answerHash, null)).toBe(false)
    expect(await driver.verify(answerHash, undefined)).toBe(false)
  })

  // -----------------------------------------------------------------------
  // generate -> computeAnswerHash -> verify cycle
  // -----------------------------------------------------------------------

  it('generate -> computeAnswerHash -> verify cycle works for easy', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    const answer = await driver.solve(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('generate -> computeAnswerHash -> verify cycle works for medium', async () => {
    const payload = await driver.generate('medium')
    const answerHash = await driver.computeAnswerHash(payload)
    const answer = await driver.solve(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('generate -> computeAnswerHash -> verify cycle works for hard', async () => {
    const payload = await driver.generate('hard')
    const answerHash = await driver.computeAnswerHash(payload)
    const answer = await driver.solve(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('generate -> computeAnswerHash -> verify cycle works for adversarial', async () => {
    const payload = await driver.generate('adversarial')
    const answerHash = await driver.computeAnswerHash(payload)
    const answer = await driver.solve(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Difficulty scaling
  // -----------------------------------------------------------------------

  it('easy challenges have 1 step', async () => {
    const payload = await driver.generate('easy')
    expect(payload.steps).toBe(1)
  })

  it('hard challenges have multiple steps', async () => {
    const payload = await driver.generate('hard')
    expect(payload.steps).toBeGreaterThanOrEqual(2)
  })

  it('adversarial challenges have 3 steps', async () => {
    const payload = await driver.generate('adversarial')
    expect(payload.steps).toBe(3)
  })

  // -----------------------------------------------------------------------
  // Context contains correct answer hashes
  // -----------------------------------------------------------------------

  it('context scoredAnswers hashes match the actual answer hashes', async () => {
    const payload = await driver.generate('medium')
    const ctx = payload.context as {
      primaryAnswer: string
      scoredAnswers: Array<{ answerHash: string; score: number }>
    }

    // The primary answer hash in context should match computeAnswerHash
    const computedHash = await driver.computeAnswerHash(payload)
    expect(ctx.scoredAnswers[0].answerHash).toBe(computedHash)
  })

  // -----------------------------------------------------------------------
  // Medium generates alternative answers
  // -----------------------------------------------------------------------

  it('medium difficulty may produce alternative scored answers', async () => {
    // Run multiple times since template selection is random
    let foundMultiple = false
    for (let i = 0; i < 20; i++) {
      const payload = await driver.generate('medium')
      const ctx = payload.context as {
        scoredAnswers: Array<{ answerHash: string; score: number }>
      }
      if (ctx.scoredAnswers.length > 1) {
        foundMultiple = true
        // All alternative scores should be < 1.0
        for (let j = 1; j < ctx.scoredAnswers.length; j++) {
          expect(ctx.scoredAnswers[j].score).toBeLessThan(1.0)
        }
        break
      }
    }
    // With 3 templates and medium difficulty, it's very likely to find alternatives
    // (famous-constant always produces alternatives)
    expect(foundMultiple).toBe(true)
  })
})
