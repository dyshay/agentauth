import { webcrypto } from 'node:crypto'
import type { ChallengeDriver, ChallengePayload, Difficulty } from '../types.js'
import { randomBytes, toHex, fromHex, sha256Hex, timingSafeEqual } from '../crypto.js'

const subtle = webcrypto.subtle

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BasicOpType = 'xor' | 'reverse' | 'slice' | 'sort' | 'rotate'
type ExtendedOpType = 'sha256' | 'bitwise_not' | 'repeat' | 'hmac' | 'base64_encode'
type OpType = BasicOpType | ExtendedOpType

interface ByteOperation {
  op: OpType
  params: Record<string, number | string>
}

// ---------------------------------------------------------------------------
// Op pools by difficulty
// ---------------------------------------------------------------------------

const BASIC_OPS: BasicOpType[] = ['xor', 'reverse', 'slice', 'sort', 'rotate']
const MEDIUM_OPS: OpType[] = [...BASIC_OPS, 'sha256', 'bitwise_not']
const ALL_OPS: OpType[] = [...MEDIUM_OPS, 'repeat', 'hmac', 'base64_encode']

const OPS_BY_DIFFICULTY: Record<Difficulty, OpType[]> = {
  easy: BASIC_OPS,
  medium: MEDIUM_OPS,
  hard: ALL_OPS,
  adversarial: ALL_OPS,
}

// ---------------------------------------------------------------------------
// Natural language phrasings — at least 3 per operation
// ---------------------------------------------------------------------------

const PHRASINGS: Record<string, ((params: Record<string, number | string>) => string)[]> = {
  xor: [
    (p) => `XOR each byte with 0x${Number(p.key).toString(16).toUpperCase()}`,
    (p) => `Apply exclusive-or with the value ${p.key} to every byte`,
    (p) => `Bitwise XOR each octet using the key ${p.key}`,
    (p) => `For every byte, flip bits using 0x${Number(p.key).toString(16)} as mask`,
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
    (p) => `Isolate bytes at positions ${p.start} through ${Number(p.end) - 1}`,
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
  sha256: [
    () => `Compute the SHA-256 hash of the current data (producing 32 raw bytes)`,
    () => `Hash the byte array with SHA-256, replacing it with the 32-byte digest`,
    () => `Apply SHA-256 to the data — the result is the raw 32-byte hash`,
  ],
  bitwise_not: [
    () => `Flip every bit in each byte (bitwise NOT, masked to 8 bits)`,
    () => `Apply bitwise complement to every byte (~byte & 0xFF)`,
    () => `Invert all bits in the array — each byte becomes its one's complement`,
  ],
  repeat: [
    (p) => `Concatenate the array with itself ${p.times} times (total ${p.times}x copies)`,
    (p) => `Repeat the data ${p.times} times by appending it to itself`,
    (p) => `Duplicate the byte sequence so it appears ${p.times} times in a row`,
  ],
  hmac: [
    (p) => `Compute HMAC-SHA256 of the data using the hex key ${p.keyHex} (producing 32 raw bytes)`,
    (p) => `HMAC the byte array with SHA-256 and key 0x${p.keyHex}, yielding 32 bytes`,
    (p) => `Apply HMAC-SHA256 using the secret key (hex) ${p.keyHex} — the result is 32 raw bytes`,
  ],
  base64_encode: [
    () => `Base64-encode the data, then treat the resulting ASCII string as a new byte array`,
    () => `Encode the bytes as a base64 string and reinterpret its characters as byte values`,
    () => `Convert the data to base64 and use the encoded string's character codes as the new bytes`,
  ],
}

// ---------------------------------------------------------------------------
// Difficulty config
// ---------------------------------------------------------------------------

const DIFFICULTY_CONFIG: Record<Difficulty, { ops: number; dataSize: number }> = {
  easy: { ops: 1, dataSize: 16 },
  medium: { ops: 2, dataSize: 32 },
  hard: { ops: 4, dataSize: 64 },
  adversarial: { ops: 6, dataSize: 128 },
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ---------------------------------------------------------------------------
// Op generation — picks from the pool appropriate for difficulty
// ---------------------------------------------------------------------------

function generateOps(count: number, dataSize: number, difficulty: Difficulty): ByteOperation[] {
  const opPool = OPS_BY_DIFFICULTY[difficulty]
  const ops: ByteOperation[] = []

  for (let i = 0; i < count; i++) {
    const op = pickRandom(opPool)
    switch (op) {
      case 'xor':
        ops.push({ op, params: { key: randomInt(1, 255) } })
        break
      case 'reverse':
        ops.push({ op, params: {} })
        break
      case 'slice': {
        const currentSize = dataSize // approximate; actual size may vary after previous ops
        const start = randomInt(0, Math.floor(currentSize / 4))
        const end = randomInt(start + 4, Math.min(start + Math.floor(currentSize / 2), currentSize))
        ops.push({ op, params: { start, end } })
        break
      }
      case 'sort':
        ops.push({ op, params: {} })
        break
      case 'rotate':
        ops.push({ op, params: { positions: randomInt(1, Math.floor(dataSize / 2)) } })
        break
      case 'sha256':
        ops.push({ op, params: {} })
        break
      case 'bitwise_not':
        ops.push({ op, params: {} })
        break
      case 'repeat': {
        const times = randomInt(2, 3)
        ops.push({ op, params: { times } })
        break
      }
      case 'hmac': {
        // Generate a random 16-byte key, embed as hex in params
        const keyBytes = randomBytes(16)
        ops.push({ op, params: { keyHex: toHex(keyBytes) } })
        break
      }
      case 'base64_encode':
        ops.push({ op, params: {} })
        break
    }
  }

  return ops
}

// ---------------------------------------------------------------------------
// Async operation execution — sha256 and hmac require crypto.subtle
// ---------------------------------------------------------------------------

async function applyOp(data: Uint8Array, op: ByteOperation): Promise<Uint8Array> {
  switch (op.op) {
    case 'xor': {
      const key = Number(op.params.key)
      const result = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i] ^ key
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
      return data.slice(Number(op.params.start), Number(op.params.end))
    case 'sort':
      return new Uint8Array([...data].sort((a, b) => a - b))
    case 'rotate': {
      const pos = Number(op.params.positions) % data.length
      const result = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) {
        result[i] = data[(i + pos) % data.length]
      }
      return result
    }
    case 'sha256': {
      const digest = await subtle.digest('SHA-256', data as Uint8Array<ArrayBuffer>)
      return new Uint8Array(digest)
    }
    case 'bitwise_not': {
      const result = new Uint8Array(data.length)
      for (let i = 0; i < data.length; i++) {
        result[i] = ~data[i] & 0xff
      }
      return result
    }
    case 'repeat': {
      const times = Number(op.params.times)
      const result = new Uint8Array(data.length * times)
      for (let t = 0; t < times; t++) {
        result.set(data, t * data.length)
      }
      return result
    }
    case 'hmac': {
      const keyBytes = fromHex(op.params.keyHex as string)
      const cryptoKey = await subtle.importKey(
        'raw',
        keyBytes as Uint8Array<ArrayBuffer>,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign'],
      )
      const signature = await subtle.sign('HMAC', cryptoKey, data as Uint8Array<ArrayBuffer>)
      return new Uint8Array(signature)
    }
    case 'base64_encode': {
      const b64 = Buffer.from(data).toString('base64')
      return new TextEncoder().encode(b64)
    }
    default: {
      // Exhaustive check
      const _exhaustive: never = op.op
      throw new Error(`Unknown operation: ${_exhaustive}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Instruction generation
// ---------------------------------------------------------------------------

function opsToInstructions(ops: ByteOperation[]): string {
  return ops
    .map((op, i) => {
      const phrasings = PHRASINGS[op.op]
      const phrasing = pickRandom(phrasings)(op.params)
      return `Step ${i + 1}: ${phrasing}`
    })
    .join('\n')
}

// ---------------------------------------------------------------------------
// Pipeline execution (now async)
// ---------------------------------------------------------------------------

async function executeOps(data: Uint8Array, ops: ByteOperation[]): Promise<Uint8Array> {
  let result = data
  for (const op of ops) {
    result = await applyOp(result, op)
  }
  return result
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class CryptoNLDriver implements ChallengeDriver {
  name = 'crypto-nl'
  dimensions = ['reasoning', 'execution'] as const
  estimatedHumanTimeMs = 60_000
  estimatedAiTimeMs = 500

  async generate(difficulty: Difficulty): Promise<ChallengePayload> {
    const config = DIFFICULTY_CONFIG[difficulty]
    const data = randomBytes(config.dataSize)
    const ops = generateOps(config.ops, config.dataSize, difficulty)
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
    const result = await executeOps(data, ops)
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

// ---------------------------------------------------------------------------
// Exports for testing internals
// ---------------------------------------------------------------------------

export { applyOp as _applyOp, executeOps as _executeOps, generateOps as _generateOps }
export type { ByteOperation, OpType }
