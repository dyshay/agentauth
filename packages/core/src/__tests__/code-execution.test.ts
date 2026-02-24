import { describe, it, expect } from 'vitest'
import { CodeExecutionDriver } from '../challenges/code-execution.js'
import type { ChallengePayload, Difficulty } from '../types.js'

describe('CodeExecutionDriver', () => {
  const driver = new CodeExecutionDriver()

  // -----------------------------------------------------------------------
  // Metadata
  // -----------------------------------------------------------------------

  it('has correct metadata', () => {
    expect(driver.name).toBe('code-execution')
    expect(driver.dimensions).toContain('execution')
    expect(driver.dimensions).toContain('reasoning')
  })

  // -----------------------------------------------------------------------
  // Generation
  // -----------------------------------------------------------------------

  it('generates a challenge payload', async () => {
    const payload = await driver.generate('easy')
    expect(payload.type).toBe('code-execution')
    expect(payload.instructions).toBeTruthy()
    expect(payload.data).toBeTruthy()
    expect(payload.steps).toBeGreaterThanOrEqual(1)
  })

  it('generates challenge with buggy code in instructions', async () => {
    const payload = await driver.generate('easy')
    expect(payload.instructions).toContain('```javascript')
    expect(payload.instructions).toContain('function')
    expect(payload.instructions).toContain('Data (hex):')
  })

  it('generates different challenges each time', async () => {
    const a = await driver.generate('medium')
    const b = await driver.generate('medium')
    // Different random data means different data fields
    expect(a.data).not.toBe(b.data)
  })

  it('includes context with correct output and bug info', async () => {
    const payload = await driver.generate('easy')
    const ctx = payload.context as Record<string, unknown>
    expect(ctx.correctOutput).toBeTruthy()
    expect(ctx.templateName).toBeTruthy()
    expect(ctx.bugs).toBeTruthy()
    expect(Array.isArray(ctx.bugs)).toBe(true)
  })

  // -----------------------------------------------------------------------
  // Solve / Verify
  // -----------------------------------------------------------------------

  it('correct answer verifies', async () => {
    const payload = await driver.generate('easy')
    const answer = await driver.solve(payload)
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('wrong answer is rejected', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, 'definitely_wrong')).toBe(false)
  })

  it('rejects non-string answer', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, 12345)).toBe(false)
    expect(await driver.verify(answerHash, null)).toBe(false)
    expect(await driver.verify(answerHash, undefined)).toBe(false)
  })

  // -----------------------------------------------------------------------
  // Difficulty scaling
  // -----------------------------------------------------------------------

  it('easy difficulty produces 1 bug', async () => {
    const payload = await driver.generate('easy')
    const ctx = payload.context as { bugs: unknown[] }
    expect(ctx.bugs).toHaveLength(1)
    expect(payload.steps).toBe(1)
  })

  it('hard difficulty produces 2 bugs', async () => {
    const payload = await driver.generate('hard')
    const ctx = payload.context as { bugs: unknown[] }
    expect(ctx.bugs).toHaveLength(2)
    expect(payload.steps).toBe(2)
  })

  it('different difficulties produce different bug counts', async () => {
    const easy = await driver.generate('easy')
    const hard = await driver.generate('hard')
    const easyBugs = (easy.context as { bugs: unknown[] }).bugs
    const hardBugs = (hard.context as { bugs: unknown[] }).bugs
    expect(hardBugs.length).toBeGreaterThan(easyBugs.length)
  })

  it('adversarial has edge-case hint in instructions', async () => {
    const payload = await driver.generate('adversarial')
    expect(payload.instructions).toContain('boundary conditions')
  })

  it('easy does not have edge-case hint', async () => {
    const payload = await driver.generate('easy')
    expect(payload.instructions).not.toContain('boundary conditions')
  })

  // -----------------------------------------------------------------------
  // Template-specific correctness checks
  // -----------------------------------------------------------------------

  it('byte_transform template computes correct output', async () => {
    // Generate many easy challenges until we get a byte_transform one
    let payload: ChallengePayload | null = null
    for (let i = 0; i < 50; i++) {
      const candidate = await driver.generate('easy')
      if ((candidate.context as Record<string, unknown>).templateName === 'byte_transform') {
        payload = candidate
        break
      }
    }

    if (!payload) {
      // Skip if we never got this template (extremely unlikely with 50 attempts)
      return
    }

    const answer = await driver.solve(payload)
    // byte_transform returns a SHA-256 hex digest (64 hex chars)
    expect(answer).toMatch(/^[a-f0-9]{64}$/)
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('array_processing template computes correct output', async () => {
    let payload: ChallengePayload | null = null
    for (let i = 0; i < 50; i++) {
      const candidate = await driver.generate('easy')
      if ((candidate.context as Record<string, unknown>).templateName === 'array_processing') {
        payload = candidate
        break
      }
    }

    if (!payload) {
      return
    }

    const answer = await driver.solve(payload)
    // array_processing returns a 2-char hex string
    expect(answer).toMatch(/^[a-f0-9]{2}$/)
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('hash_chain template computes correct output', async () => {
    // hash_chain is only available in medium+
    let payload: ChallengePayload | null = null
    for (let i = 0; i < 50; i++) {
      const candidate = await driver.generate('medium')
      if ((candidate.context as Record<string, unknown>).templateName === 'hash_chain') {
        payload = candidate
        break
      }
    }

    if (!payload) {
      return
    }

    const answer = await driver.solve(payload)
    // hash_chain returns a hex string (64 hex chars, SHA-256 length after reversal)
    expect(answer).toMatch(/^[a-f0-9]{64}$/)
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  // -----------------------------------------------------------------------
  // All difficulties generate valid, solvable challenges
  // -----------------------------------------------------------------------

  const difficulties: Difficulty[] = ['easy', 'medium', 'hard', 'adversarial']
  for (const diff of difficulties) {
    it(`generates solvable challenge at ${diff} difficulty`, async () => {
      const payload = await driver.generate(diff)
      const answer = await driver.solve(payload)
      expect(answer).toBeTruthy()
      const answerHash = await driver.computeAnswerHash(payload)
      expect(await driver.verify(answerHash, answer)).toBe(true)
    })
  }
})
