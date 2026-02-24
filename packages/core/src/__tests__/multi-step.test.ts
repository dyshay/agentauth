import { describe, it, expect } from 'vitest'
import { MultiStepDriver } from '../challenges/multi-step.js'

describe('MultiStepDriver', () => {
  const driver = new MultiStepDriver()

  it('has correct metadata', () => {
    expect(driver.name).toBe('multi-step')
    expect(driver.dimensions).toContain('reasoning')
    expect(driver.dimensions).toContain('execution')
    expect(driver.dimensions).toContain('memory')
  })

  it('generates a challenge with instructions and data', async () => {
    const payload = await driver.generate('easy')
    expect(payload.type).toBe('multi-step')
    expect(payload.instructions).toBeTruthy()
    expect(payload.instructions).toContain('Step 1:')
    expect(payload.data).toBeTruthy()
    expect(payload.steps).toBeGreaterThanOrEqual(1)
    expect(payload.context).toBeDefined()
    expect(payload.context?.stepDefs).toBeDefined()
    expect(payload.context?.expectedResults).toBeDefined()
    expect(payload.context?.expectedAnswer).toBeDefined()
  })

  it('generates different challenges each time', async () => {
    const a = await driver.generate('medium')
    const b = await driver.generate('medium')
    // Either data or expected results should differ (randomized)
    const aDiff = `${a.data}:${(a.context?.expectedAnswer as string)}`
    const bDiff = `${b.data}:${(b.context?.expectedAnswer as string)}`
    expect(aDiff).not.toBe(bDiff)
  })

  it('easy challenge has 3 steps', async () => {
    const payload = await driver.generate('easy')
    expect(payload.steps).toBe(3)
    expect((payload.context?.stepDefs as unknown[]).length).toBe(3)
    expect((payload.context?.expectedResults as unknown[]).length).toBe(3)
  })

  it('medium challenge has 4 steps with memory recall', async () => {
    const payload = await driver.generate('medium')
    expect(payload.steps).toBe(4)
    const stepDefs = payload.context?.stepDefs as Array<{ type: string }>
    expect(stepDefs.length).toBe(4)

    // At least one step should be a memory_recall
    const hasRecall = stepDefs.some((s) => s.type === 'memory_recall')
    expect(hasRecall).toBe(true)
  })

  it('hard challenge has 5 steps with memory recall and memory apply', async () => {
    const payload = await driver.generate('hard')
    expect(payload.steps).toBe(5)
    const stepDefs = payload.context?.stepDefs as Array<{ type: string }>
    expect(stepDefs.length).toBe(5)

    const hasRecall = stepDefs.some((s) => s.type === 'memory_recall')
    const hasApply = stepDefs.some((s) => s.type === 'memory_apply')
    expect(hasRecall).toBe(true)
    expect(hasApply).toBe(true)
  })

  it('adversarial challenge has 7 steps', async () => {
    const payload = await driver.generate('adversarial')
    expect(payload.steps).toBe(7)
    const stepDefs = payload.context?.stepDefs as Array<{ type: string }>
    expect(stepDefs.length).toBe(7)
  })

  it('generate -> solve -> verify cycle works for easy', async () => {
    const payload = await driver.generate('easy')
    const answer = await driver.solve(payload)
    expect(answer).toMatch(/^[a-f0-9]{64}$/) // SHA-256 hex

    const answerHash = await driver.computeAnswerHash(payload)
    const verified = await driver.verify(answerHash, answer)
    expect(verified).toBe(true)
  })

  it('generate -> solve -> verify cycle works for medium', async () => {
    const payload = await driver.generate('medium')
    const answer = await driver.solve(payload)
    expect(answer).toMatch(/^[a-f0-9]{64}$/)

    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('generate -> solve -> verify cycle works for hard', async () => {
    const payload = await driver.generate('hard')
    const answer = await driver.solve(payload)
    expect(answer).toMatch(/^[a-f0-9]{64}$/)

    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('generate -> solve -> verify cycle works for adversarial', async () => {
    const payload = await driver.generate('adversarial')
    const answer = await driver.solve(payload)
    expect(answer).toMatch(/^[a-f0-9]{64}$/)

    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, answer)).toBe(true)
  })

  it('solve result matches expected answer from context', async () => {
    const payload = await driver.generate('easy')
    const answer = await driver.solve(payload)
    expect(answer).toBe(payload.context?.expectedAnswer)
  })

  it('rejects wrong answer', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, 'wrong')).toBe(false)
    expect(await driver.verify(answerHash, 'a'.repeat(64))).toBe(false)
  })

  it('rejects non-string answer', async () => {
    const payload = await driver.generate('easy')
    const answerHash = await driver.computeAnswerHash(payload)
    expect(await driver.verify(answerHash, 42)).toBe(false)
    expect(await driver.verify(answerHash, null)).toBe(false)
  })

  it('instructions contain result labels', async () => {
    const payload = await driver.generate('easy')
    expect(payload.instructions).toContain('R1')
    expect(payload.instructions).toContain('R2')
    expect(payload.instructions).toContain('R3')
    expect(payload.instructions).toContain('final answer')
  })

  it('instructions contain final answer formula', async () => {
    const payload = await driver.generate('medium')
    expect(payload.instructions).toContain('SHA-256 of the concatenation')
    expect(payload.instructions).toContain('R1 + R2 + R3 + R4')
  })
})
