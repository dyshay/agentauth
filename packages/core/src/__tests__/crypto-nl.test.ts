import { describe, it, expect } from 'vitest'
import { webcrypto } from 'node:crypto'
import { CryptoNLDriver, _applyOp, _executeOps, _generateOps } from '../challenges/crypto-nl.js'
import type { ByteOperation } from '../challenges/crypto-nl.js'
import { fromHex, toHex, sha256Hex } from '../crypto.js'

const subtle = webcrypto.subtle

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

// ---------------------------------------------------------------------------
// New operation unit tests
// ---------------------------------------------------------------------------

describe('CryptoNL — new byte operations', () => {
  const input = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])

  describe('sha256 operation', () => {
    it('produces exactly 32 bytes', async () => {
      const op: ByteOperation = { op: 'sha256', params: {} }
      const result = await _applyOp(input, op)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(32)
    })

    it('matches webcrypto SHA-256 digest', async () => {
      const op: ByteOperation = { op: 'sha256', params: {} }
      const result = await _applyOp(input, op)
      const expected = new Uint8Array(await subtle.digest('SHA-256', input))
      expect(toHex(result)).toBe(toHex(expected))
    })

    it('is deterministic', async () => {
      const op: ByteOperation = { op: 'sha256', params: {} }
      const a = await _applyOp(input, op)
      const b = await _applyOp(input, op)
      expect(toHex(a)).toBe(toHex(b))
    })
  })

  describe('bitwise_not operation', () => {
    it('flips all bits', async () => {
      const op: ByteOperation = { op: 'bitwise_not', params: {} }
      const result = await _applyOp(input, op)
      expect(result.length).toBe(input.length)
      for (let i = 0; i < input.length; i++) {
        expect(result[i]).toBe(~input[i] & 0xff)
      }
    })

    it('double NOT restores original', async () => {
      const op: ByteOperation = { op: 'bitwise_not', params: {} }
      const once = await _applyOp(input, op)
      const twice = await _applyOp(once, op)
      expect(toHex(twice)).toBe(toHex(input))
    })

    it('0x00 becomes 0xFF and vice versa', async () => {
      const op: ByteOperation = { op: 'bitwise_not', params: {} }
      const data = new Uint8Array([0x00, 0xff])
      const result = await _applyOp(data, op)
      expect(result[0]).toBe(0xff)
      expect(result[1]).toBe(0x00)
    })
  })

  describe('repeat operation', () => {
    it('duplicates the array N times', async () => {
      const op: ByteOperation = { op: 'repeat', params: { times: 3 } }
      const result = await _applyOp(input, op)
      expect(result.length).toBe(input.length * 3)
      // First copy
      expect(toHex(result.slice(0, input.length))).toBe(toHex(input))
      // Second copy
      expect(toHex(result.slice(input.length, input.length * 2))).toBe(toHex(input))
      // Third copy
      expect(toHex(result.slice(input.length * 2))).toBe(toHex(input))
    })

    it('repeat 2 doubles the length', async () => {
      const op: ByteOperation = { op: 'repeat', params: { times: 2 } }
      const result = await _applyOp(input, op)
      expect(result.length).toBe(input.length * 2)
    })
  })

  describe('hmac operation', () => {
    it('produces exactly 32 bytes', async () => {
      const keyHex = toHex(new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]))
      const op: ByteOperation = { op: 'hmac', params: { keyHex } }
      const result = await _applyOp(input, op)
      expect(result).toBeInstanceOf(Uint8Array)
      expect(result.length).toBe(32)
    })

    it('matches webcrypto HMAC-SHA256', async () => {
      const keyBytes = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08])
      const keyHex = toHex(keyBytes)
      const op: ByteOperation = { op: 'hmac', params: { keyHex } }
      const result = await _applyOp(input, op)

      const cryptoKey = await subtle.importKey(
        'raw',
        keyBytes,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const expected = new Uint8Array(await subtle.sign('HMAC', cryptoKey, input))
      expect(toHex(result)).toBe(toHex(expected))
    })

    it('different keys produce different results', async () => {
      const op1: ByteOperation = { op: 'hmac', params: { keyHex: 'aabbccdd' } }
      const op2: ByteOperation = { op: 'hmac', params: { keyHex: '11223344' } }
      const r1 = await _applyOp(input, op1)
      const r2 = await _applyOp(input, op2)
      expect(toHex(r1)).not.toBe(toHex(r2))
    })
  })

  describe('base64_encode operation', () => {
    it('encodes bytes as base64 and converts to byte array', async () => {
      const op: ByteOperation = { op: 'base64_encode', params: {} }
      const data = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]) // "Hello"
      const result = await _applyOp(data, op)
      // "Hello" in base64 = "SGVsbG8="
      const expected = new TextEncoder().encode('SGVsbG8=')
      expect(toHex(result)).toBe(toHex(expected))
    })

    it('result length is larger than input (base64 expansion)', async () => {
      const op: ByteOperation = { op: 'base64_encode', params: {} }
      const result = await _applyOp(input, op)
      expect(result.length).toBeGreaterThan(input.length)
    })

    it('all result bytes are valid ASCII', async () => {
      const op: ByteOperation = { op: 'base64_encode', params: {} }
      const result = await _applyOp(input, op)
      for (const byte of result) {
        expect(byte).toBeLessThanOrEqual(127)
        expect(byte).toBeGreaterThanOrEqual(32) // printable ASCII
      }
    })
  })
})

// ---------------------------------------------------------------------------
// Difficulty-based op pool tests
// ---------------------------------------------------------------------------

describe('CryptoNL — difficulty op pools', () => {
  it('easy generates only basic ops', () => {
    const basicOps = new Set(['xor', 'reverse', 'slice', 'sort', 'rotate'])
    // Generate many ops to get statistical coverage
    for (let trial = 0; trial < 20; trial++) {
      const ops = _generateOps(3, 16, 'easy')
      for (const op of ops) {
        expect(basicOps.has(op.op)).toBe(true)
      }
    }
  })

  it('medium can include sha256 or bitwise_not', () => {
    const mediumOps = new Set(['xor', 'reverse', 'slice', 'sort', 'rotate', 'sha256', 'bitwise_not'])
    for (let trial = 0; trial < 20; trial++) {
      const ops = _generateOps(4, 32, 'medium')
      for (const op of ops) {
        expect(mediumOps.has(op.op)).toBe(true)
      }
    }
  })

  it('hard can include all ops', () => {
    const allOps = new Set([
      'xor', 'reverse', 'slice', 'sort', 'rotate',
      'sha256', 'bitwise_not', 'repeat', 'hmac', 'base64_encode',
    ])
    for (let trial = 0; trial < 20; trial++) {
      const ops = _generateOps(6, 64, 'hard')
      for (const op of ops) {
        expect(allOps.has(op.op)).toBe(true)
      }
    }
  })

  it('hard difficulty uses expanded op set (at least one extended op in many trials)', () => {
    const extendedOps = new Set(['sha256', 'bitwise_not', 'repeat', 'hmac', 'base64_encode'])
    let foundExtended = false
    // With 6 ops per trial from a pool of 10, and 50 trials, the probability of
    // never seeing an extended op is astronomically small
    for (let trial = 0; trial < 50; trial++) {
      const ops = _generateOps(6, 64, 'hard')
      if (ops.some((o) => extendedOps.has(o.op))) {
        foundExtended = true
        break
      }
    }
    expect(foundExtended).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Full generate -> solve -> verify cycle for all difficulties
// ---------------------------------------------------------------------------

describe('CryptoNL — generate/solve/verify cycle', () => {
  const driver = new CryptoNLDriver()

  for (const difficulty of ['easy', 'medium', 'hard', 'adversarial'] as const) {
    it(`works end-to-end for ${difficulty}`, async () => {
      const payload = await driver.generate(difficulty)
      expect(payload.type).toBe('crypto-nl')
      expect(payload.steps).toBeGreaterThanOrEqual(1)

      const answer = await driver.solve(payload)
      expect(answer).toMatch(/^[a-f0-9]{64}$/)

      const answerHash = await driver.computeAnswerHash(payload)
      expect(await driver.verify(answerHash, answer)).toBe(true)
      expect(await driver.verify(answerHash, 'wrong-answer')).toBe(false)
    })
  }
})

// ---------------------------------------------------------------------------
// Pipeline / executeOps tests
// ---------------------------------------------------------------------------

describe('CryptoNL — executeOps pipeline', () => {
  it('chains multiple async ops correctly', async () => {
    const data = new Uint8Array([0x10, 0x20, 0x30, 0x40])
    const ops: ByteOperation[] = [
      { op: 'bitwise_not', params: {} },
      { op: 'reverse', params: {} },
    ]
    const result = await _executeOps(data, ops)

    // Manual: NOT [0x10, 0x20, 0x30, 0x40] = [0xEF, 0xDF, 0xCF, 0xBF]
    // Reverse: [0xBF, 0xCF, 0xDF, 0xEF]
    expect(toHex(result)).toBe('bfcfdfef')
  })

  it('sha256 followed by slice produces 32 bytes then sliced', async () => {
    const data = new Uint8Array([0xAA, 0xBB, 0xCC])
    const ops: ByteOperation[] = [
      { op: 'sha256', params: {} },
      { op: 'slice', params: { start: 0, end: 8 } },
    ]
    const result = await _executeOps(data, ops)
    expect(result.length).toBe(8)
  })

  it('repeat then sha256 works', async () => {
    const data = new Uint8Array([0x01, 0x02])
    const ops: ByteOperation[] = [
      { op: 'repeat', params: { times: 3 } },
      { op: 'sha256', params: {} },
    ]
    const result = await _executeOps(data, ops)
    expect(result.length).toBe(32) // sha256 always 32 bytes

    // Verify manually: repeat [01, 02] x3 = [01, 02, 01, 02, 01, 02], then sha256
    const repeated = new Uint8Array([0x01, 0x02, 0x01, 0x02, 0x01, 0x02])
    const expectedDigest = new Uint8Array(await subtle.digest('SHA-256', repeated))
    expect(toHex(result)).toBe(toHex(expectedDigest))
  })
})
