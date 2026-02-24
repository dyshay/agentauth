import { webcrypto } from 'node:crypto'
import type { ChallengeDriver, ChallengePayload, Difficulty } from '../types.js'
import { randomBytes, toHex, fromHex, sha256Hex, timingSafeEqual } from '../crypto.js'

const subtle = webcrypto.subtle

// ---------------------------------------------------------------------------
// Step definitions
// ---------------------------------------------------------------------------

type StepDef =
  | { type: 'sha256' }
  | { type: 'xor'; key: number }
  | { type: 'hmac'; key: string }
  | { type: 'slice'; start: number; end: number }
  | { type: 'memory_recall'; step: number; byteIndex: number }
  | { type: 'memory_apply'; step: number }

interface StepResult {
  def: StepDef
  result: string // hex string of intermediate result
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function hmacSha256HexBytes(key: Uint8Array, message: Uint8Array): Promise<string> {
  const importedKey = await subtle.importKey(
    'raw',
    key as Uint8Array<ArrayBuffer>,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await subtle.sign('HMAC', importedKey, message as Uint8Array<ArrayBuffer>)
  return toHex(new Uint8Array(signature))
}

function xorBytes(data: Uint8Array, key: number): string {
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ (key & 0xff)
  }
  return toHex(result)
}

function sliceHex(hex: string, start: number, end: number): string {
  const bytes = fromHex(hex)
  const sliced = bytes.slice(start, end)
  return toHex(sliced)
}

// ---------------------------------------------------------------------------
// Step execution
// ---------------------------------------------------------------------------

async function executeStep(
  stepIndex: number,
  def: StepDef,
  inputDataHex: string,
  previousResults: StepResult[],
): Promise<string> {
  switch (def.type) {
    case 'sha256': {
      // Hash input data (or previous result if not the first step)
      const source = stepIndex === 0 ? inputDataHex : previousResults[stepIndex - 1].result
      const bytes = fromHex(source)
      return sha256Hex(bytes)
    }

    case 'xor': {
      const source = stepIndex === 0 ? inputDataHex : previousResults[stepIndex - 1].result
      const bytes = fromHex(source)
      return xorBytes(bytes, def.key)
    }

    case 'hmac': {
      // Use the previous step result as key and input data as message,
      // or if first step, use the provided key with input data
      if (stepIndex === 0) {
        const keyBytes = fromHex(def.key)
        const msgBytes = fromHex(inputDataHex)
        return hmacSha256HexBytes(keyBytes, msgBytes)
      }
      const keyBytes = fromHex(previousResults[stepIndex - 1].result)
      const msgBytes = fromHex(inputDataHex)
      return hmacSha256HexBytes(keyBytes, msgBytes)
    }

    case 'slice': {
      const source = stepIndex === 0 ? inputDataHex : previousResults[stepIndex - 1].result
      return sliceHex(source, def.start, def.end)
    }

    case 'memory_recall': {
      // Return the hex value of byte N from step M's result
      const targetResult = previousResults[def.step].result
      const bytes = fromHex(targetResult)
      const byte = bytes[def.byteIndex]
      return byte.toString(16).padStart(2, '0')
    }

    case 'memory_apply': {
      // Apply the same operation as the referenced step to the current data
      const refDef = previousResults[def.step].def
      const source = previousResults[stepIndex - 1].result
      // Re-execute the referenced operation type on current data
      return executeStep(stepIndex, refDef, inputDataHex, [
        ...previousResults.slice(0, stepIndex - 1),
        previousResults[stepIndex - 1],
      ])
    }
  }
}

async function executeAllSteps(
  steps: StepDef[],
  inputDataHex: string,
): Promise<StepResult[]> {
  const results: StepResult[] = []
  for (let i = 0; i < steps.length; i++) {
    const result = await executeStep(i, steps[i], inputDataHex, results)
    results.push({ def: steps[i], result })
  }
  return results
}

async function computeFinalAnswer(stepResults: StepResult[]): Promise<string> {
  const concatenated = stepResults.map((r) => r.result).join('')
  const bytes = new TextEncoder().encode(concatenated)
  return sha256Hex(bytes)
}

// ---------------------------------------------------------------------------
// Natural language instruction generation
// ---------------------------------------------------------------------------

const SHA256_PHRASINGS = [
  (ref: string) => `Compute the SHA-256 hash of ${ref}. Your result is`,
  (ref: string) => `Hash ${ref} using SHA-256. Your result is`,
  (ref: string) => `Apply SHA-256 to ${ref}. Your result is`,
]

const XOR_PHRASINGS = [
  (ref: string, key: number) =>
    `XOR each byte of ${ref} with 0x${key.toString(16).padStart(2, '0').toUpperCase()}. Your result is`,
  (ref: string, key: number) =>
    `Apply exclusive-or with the value ${key} to every byte of ${ref}. Your result is`,
  (ref: string, key: number) =>
    `Bitwise XOR each byte of ${ref} using the key 0x${key.toString(16).padStart(2, '0')}. Your result is`,
]

const HMAC_PHRASINGS = [
  (keyRef: string, msgRef: string) =>
    `Compute HMAC-SHA256 with ${keyRef} as key and ${msgRef} as message. Your result is`,
  (keyRef: string, msgRef: string) =>
    `Use ${keyRef} as an HMAC-SHA256 key to sign ${msgRef}. Your result is`,
]

const SLICE_PHRASINGS = [
  (ref: string, start: number, end: number) =>
    `Take bytes ${start} through ${end - 1} (inclusive) from ${ref}. Your result is`,
  (ref: string, start: number, end: number) =>
    `Extract the first ${end - start} bytes of ${ref} starting at offset ${start}. Your result is`,
]

const RECALL_PHRASINGS = [
  (stepNum: number, byteIndex: number) =>
    `What was byte ${byteIndex} (0-indexed) of your result R${stepNum}? Express as a 2-digit hex value. Your result is`,
  (stepNum: number, byteIndex: number) =>
    `Recall the value of byte at position ${byteIndex} in R${stepNum}, written as two hex digits. Your result is`,
]

const APPLY_PHRASINGS = [
  (stepNum: number, prevRef: string) =>
    `Apply the same operation you performed in step ${stepNum} to ${prevRef}. Your result is`,
  (stepNum: number, prevRef: string) =>
    `Repeat the operation from step ${stepNum}, but this time on ${prevRef}. Your result is`,
]

function generateInstruction(
  stepIndex: number,
  def: StepDef,
  inputDataHex: string,
  totalSteps: number,
): string {
  const stepNum = stepIndex + 1
  const resultLabel = `R${stepNum}`
  const prevRef = stepIndex === 0 ? 'the provided data' : `R${stepIndex}`

  switch (def.type) {
    case 'sha256': {
      const ref = stepIndex === 0 ? 'the provided data' : `R${stepIndex}`
      const phrasing = pickRandom(SHA256_PHRASINGS)(ref)
      return `Step ${stepNum}: ${phrasing} ${resultLabel}.`
    }

    case 'xor': {
      const ref = stepIndex === 0 ? 'the provided data' : `R${stepIndex}`
      const phrasing = pickRandom(XOR_PHRASINGS)(ref, def.key)
      return `Step ${stepNum}: ${phrasing} ${resultLabel}.`
    }

    case 'hmac': {
      if (stepIndex === 0) {
        const phrasing = pickRandom(HMAC_PHRASINGS)(
          `the hex key "${def.key}"`,
          'the provided data',
        )
        return `Step ${stepNum}: ${phrasing} ${resultLabel}.`
      }
      const phrasing = pickRandom(HMAC_PHRASINGS)(`R${stepIndex}`, 'the provided data')
      return `Step ${stepNum}: ${phrasing} ${resultLabel}.`
    }

    case 'slice': {
      const ref = stepIndex === 0 ? 'the provided data' : `R${stepIndex}`
      const phrasing = pickRandom(SLICE_PHRASINGS)(ref, def.start, def.end)
      return `Step ${stepNum}: ${phrasing} ${resultLabel}.`
    }

    case 'memory_recall': {
      const phrasing = pickRandom(RECALL_PHRASINGS)(def.step + 1, def.byteIndex)
      return `Step ${stepNum}: ${phrasing} ${resultLabel}.`
    }

    case 'memory_apply': {
      const phrasing = pickRandom(APPLY_PHRASINGS)(def.step + 1, prevRef)
      return `Step ${stepNum}: ${phrasing} ${resultLabel}.`
    }
  }
}

function generateAllInstructions(steps: StepDef[], inputDataHex: string): string {
  const stepInstructions = steps.map((def, i) =>
    generateInstruction(i, def, inputDataHex, steps.length),
  )

  const resultRefs = steps.map((_, i) => `R${i + 1}`).join(' + ')
  const footer = `\nYour final answer: SHA-256 of the concatenation of ${resultRefs} (all as lowercase hex strings, concatenated without separators).`

  return stepInstructions.join('\n') + footer
}

// ---------------------------------------------------------------------------
// Step generation per difficulty
// ---------------------------------------------------------------------------

interface DifficultyConfig {
  totalSteps: number
  dataSize: number
  computeSteps: number
  memoryRecall: number
  memoryApply: number
}

const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  easy: { totalSteps: 3, dataSize: 32, computeSteps: 3, memoryRecall: 0, memoryApply: 0 },
  medium: { totalSteps: 4, dataSize: 32, computeSteps: 3, memoryRecall: 1, memoryApply: 0 },
  hard: { totalSteps: 5, dataSize: 64, computeSteps: 3, memoryRecall: 1, memoryApply: 1 },
  adversarial: { totalSteps: 7, dataSize: 64, computeSteps: 4, memoryRecall: 2, memoryApply: 1 },
}

type ComputeStepType = 'sha256' | 'xor' | 'hmac' | 'slice'

function generateComputeStep(
  stepIndex: number,
  dataSize: number,
  previousResults: StepResult[],
): StepDef {
  const types: ComputeStepType[] = ['sha256', 'xor', 'hmac', 'slice']

  // First step: prefer sha256 or xor (they don't need previous results in a special way)
  const available = stepIndex === 0 ? ['sha256', 'xor'] as ComputeStepType[] : types
  const type = pickRandom(available)

  switch (type) {
    case 'sha256':
      return { type: 'sha256' }

    case 'xor':
      return { type: 'xor', key: randomInt(1, 255) }

    case 'hmac': {
      if (stepIndex === 0) {
        // Generate a random key for the first step
        const key = toHex(randomBytes(16))
        return { type: 'hmac', key }
      }
      // Use previous result as key
      return { type: 'hmac', key: '' } // key unused; previous result is used
    }

    case 'slice': {
      // Determine the size of the data we'd be slicing
      const prevResultLen =
        stepIndex === 0
          ? dataSize
          : fromHex(previousResults[stepIndex - 1]?.result ?? '').length || 32

      // Ensure we can slice something meaningful
      const maxEnd = Math.max(prevResultLen, 4)
      const start = randomInt(0, Math.floor(maxEnd / 4))
      const end = randomInt(start + 2, Math.min(start + Math.floor(maxEnd / 2), maxEnd))
      return { type: 'slice', start, end }
    }
  }
}

function generateMemoryRecallStep(previousResults: StepResult[]): StepDef {
  // Pick a random previous step to recall from
  const stepIdx = randomInt(0, previousResults.length - 1)
  const resultBytes = fromHex(previousResults[stepIdx].result)
  const byteIndex = randomInt(0, resultBytes.length - 1)
  return { type: 'memory_recall', step: stepIdx, byteIndex }
}

function generateMemoryApplyStep(previousResults: StepResult[]): StepDef {
  // Find a compute step (not memory_recall or memory_apply) to reference
  const computeSteps = previousResults
    .map((r, i) => ({ idx: i, def: r.def }))
    .filter(
      (s) => s.def.type !== 'memory_recall' && s.def.type !== 'memory_apply',
    )

  if (computeSteps.length === 0) {
    // Fallback: just reference step 0
    return { type: 'memory_apply', step: 0 }
  }

  const target = pickRandom(computeSteps)
  return { type: 'memory_apply', step: target.idx }
}

async function generateSteps(
  difficulty: Difficulty,
  inputDataHex: string,
): Promise<{ steps: StepDef[]; results: StepResult[] }> {
  const config = DIFFICULTY_CONFIGS[difficulty]
  const steps: StepDef[] = []
  const results: StepResult[] = []

  // Generate compute steps first
  for (let i = 0; i < config.computeSteps; i++) {
    const def = generateComputeStep(i, config.dataSize, results)
    steps.push(def)
    const result = await executeStep(i, def, inputDataHex, results)
    results.push({ def, result })
  }

  // Insert memory recall steps
  for (let i = 0; i < config.memoryRecall; i++) {
    const def = generateMemoryRecallStep(results)
    const stepIdx = steps.length
    steps.push(def)
    const result = await executeStep(stepIdx, def, inputDataHex, results)
    results.push({ def, result })
  }

  // Insert memory apply steps
  for (let i = 0; i < config.memoryApply; i++) {
    const def = generateMemoryApplyStep(results)
    const stepIdx = steps.length
    steps.push(def)
    const result = await executeStep(stepIdx, def, inputDataHex, results)
    results.push({ def, result })
  }

  return { steps, results }
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class MultiStepDriver implements ChallengeDriver {
  name = 'multi-step'
  dimensions = ['reasoning', 'execution', 'memory'] as const
  estimatedHumanTimeMs = 120_000
  estimatedAiTimeMs = 2_000

  async generate(difficulty: Difficulty): Promise<ChallengePayload> {
    const config = DIFFICULTY_CONFIGS[difficulty]
    const data = randomBytes(config.dataSize)
    const inputDataHex = toHex(data)

    const { steps, results } = await generateSteps(difficulty, inputDataHex)
    const finalAnswer = await computeFinalAnswer(results)

    const instructions = generateAllInstructions(steps, inputDataHex)

    return {
      type: 'multi-step',
      instructions,
      data: Buffer.from(data).toString('base64'),
      steps: steps.length,
      context: {
        stepDefs: steps,
        expectedResults: results.map((r) => r.result),
        expectedAnswer: finalAnswer,
      },
    }
  }

  async solve(payload: ChallengePayload): Promise<string> {
    const data = new Uint8Array(Buffer.from(payload.data, 'base64'))
    const inputDataHex = toHex(data)
    const stepDefs = payload.context?.stepDefs as StepDef[]

    const results = await executeAllSteps(stepDefs, inputDataHex)
    return computeFinalAnswer(results)
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
