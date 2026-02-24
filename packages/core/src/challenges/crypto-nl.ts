import type { ChallengeDriver, ChallengePayload, Difficulty } from '../types.js'
import { randomBytes, toHex, sha256Hex, timingSafeEqual } from '../crypto.js'

interface ByteOperation {
  op: 'xor' | 'reverse' | 'slice' | 'sort' | 'rotate'
  params: Record<string, number>
}

const PHRASINGS: Record<string, ((params: Record<string, number>) => string)[]> = {
  xor: [
    (p) => `XOR each byte with 0x${p.key.toString(16).toUpperCase()}`,
    (p) => `Apply exclusive-or with the value ${p.key} to every byte`,
    (p) => `Bitwise XOR each octet using the key ${p.key}`,
    (p) => `For every byte, flip bits using 0x${p.key.toString(16)} as mask`,
  ],
  reverse: [
    () => `Reverse the byte order`,
    () => `Flip the sequence end-to-end`,
    () => `Mirror the byte array so the last byte becomes first`,
    () => `Invert the positional ordering of all bytes`,
  ],
  slice: [
    (p) => `Take bytes from offset ${p.start} to ${p.end}`,
    (p) => `Extract the slice [${p.start}:${p.end}] from the data`,
    (p) => `Isolate bytes at positions ${p.start} through ${p.end - 1}`,
  ],
  sort: [
    () => `Sort all bytes in ascending order`,
    () => `Arrange the bytes from smallest to largest value`,
    () => `Order the octets numerically, lowest first`,
  ],
  rotate: [
    (p) => `Rotate the bytes left by ${p.positions} positions`,
    (p) => `Shift all bytes ${p.positions} positions to the left, wrapping around`,
    (p) => `Circular left-shift the array by ${p.positions}`,
  ],
}

const DIFFICULTY_CONFIG: Record<Difficulty, { ops: number; dataSize: number }> = {
  easy: { ops: 1, dataSize: 16 },
  medium: { ops: 2, dataSize: 32 },
  hard: { ops: 4, dataSize: 64 },
  adversarial: { ops: 6, dataSize: 128 },
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function generateOps(count: number, dataSize: number): ByteOperation[] {
  const opTypes: ByteOperation['op'][] = ['xor', 'reverse', 'slice', 'sort', 'rotate']
  const ops: ByteOperation[] = []

  for (let i = 0; i < count; i++) {
    const op = pickRandom(opTypes)
    switch (op) {
      case 'xor':
        ops.push({ op, params: { key: randomInt(1, 255) } })
        break
      case 'reverse':
        ops.push({ op, params: {} })
        break
      case 'slice': {
        const start = randomInt(0, Math.floor(dataSize / 4))
        const end = randomInt(start + 4, Math.min(start + Math.floor(dataSize / 2), dataSize))
        ops.push({ op, params: { start, end } })
        break
      }
      case 'sort':
        ops.push({ op, params: {} })
        break
      case 'rotate':
        ops.push({ op, params: { positions: randomInt(1, Math.floor(dataSize / 2)) } })
        break
    }
  }

  return ops
}

function applyOp(data: Uint8Array, op: ByteOperation): Uint8Array {
  switch (op.op) {
    case 'xor': {
      const result = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ op.params.key
      }
      return result
    }
    case 'reverse': {
      const result = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) {
        result[i] = data[data.length - 1 - i]
      }
      return result
    }
    case 'slice':
      return data.slice(op.params.start, op.params.end)
    case 'sort':
      return new Uint8Array([...data].sort((a, b) => a - b))
    case 'rotate': {
      const pos = op.params.positions % data.length
      const result = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) {
        result[i] = data[(i + pos) % data.length]
      }
      return result
    }
  }
}

function opsToInstructions(ops: ByteOperation[]): string {
  return ops
    .map((op, i) => {
      const phrasings = PHRASINGS[op.op]
      const phrasing = pickRandom(phrasings)(op.params)
      return `Step ${i + 1}: ${phrasing}`
    })
    .join('\n')
}

function executeOps(data: Uint8Array, ops: ByteOperation[]): Uint8Array {
  let result = data
  for (const op of ops) {
    result = applyOp(result, op)
  }
  return result
}

export class CryptoNLDriver implements ChallengeDriver {
  name = 'crypto-nl'
  dimensions = ['reasoning', 'execution'] as const
  estimatedHumanTimeMs = 60_000
  estimatedAiTimeMs = 500

  async generate(difficulty: Difficulty): Promise<ChallengePayload> {
    const config = DIFFICULTY_CONFIG[difficulty]
    const data = randomBytes(config.dataSize)
    const ops = generateOps(config.ops, config.dataSize)
    const instructions = opsToInstructions(ops)

    // Encode ops in context so we can recompute the answer during verification
    return {
      type: 'crypto-nl',
      instructions: `${instructions}\n\nThen compute the SHA-256 hex digest of the final result.`,
      data: Buffer.from(data).toString('base64'),
      steps: ops.length,
      context: { ops },
    }
  }

  async solve(payload: ChallengePayload): Promise<string> {
    const data = new Uint8Array(Buffer.from(payload.data, 'base64'))
    const ops = payload.context?.ops as ByteOperation[]
    const result = executeOps(data, ops)
    return sha256Hex(result)
  }

  async computeAnswerHash(payload: ChallengePayload): Promise<string> {
    const answer = await this.solve(payload)
    return sha256Hex(new TextEncoder().encode(answer))
  }

  async verify(answerHash: string, submittedAnswer: unknown): Promise<boolean> {
    if (typeof submittedAnswer !== 'string') return false
    const submittedHash = await sha256Hex(new TextEncoder().encode(submittedAnswer))
    return timingSafeEqual(answerHash, submittedHash)
  }
}
