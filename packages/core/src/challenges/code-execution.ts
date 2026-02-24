import type { ChallengeDriver, ChallengePayload, Difficulty } from '../types.js'
import { randomBytes, toHex, sha256Hex, timingSafeEqual } from '../crypto.js'

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// ---------------------------------------------------------------------------
// Bug definitions
// ---------------------------------------------------------------------------

interface BugDef {
  /** Unique name for this bug type */
  name: string
  /** Human-readable description */
  description: string
}

const BUG_OFF_BY_ONE: BugDef = {
  name: 'off_by_one',
  description: 'Uses % 255 instead of % 256 in modulo operation',
}

const BUG_WRONG_OPERATOR: BugDef = {
  name: 'wrong_operator',
  description: 'Uses + (addition) instead of ^ (XOR) as the accumulator operator',
}

const BUG_MISSING_STEP: BugDef = {
  name: 'missing_step',
  description: 'Missing byte reversal between hash rounds',
}

const BUG_WRONG_INIT: BugDef = {
  name: 'wrong_init',
  description: 'Accumulator initialized to 1 instead of 0',
}

const BUG_WRONG_PAD: BugDef = {
  name: 'wrong_pad',
  description: 'padStart uses length 1 instead of 2 for hex encoding',
}

const BUG_WRONG_SHIFT: BugDef = {
  name: 'wrong_shift',
  description: 'Shift amount is 7 instead of 8 in bit shifting',
}

// ---------------------------------------------------------------------------
// Code template interface
// ---------------------------------------------------------------------------

interface CodeTemplate {
  /** Template name */
  name: string
  /** Bugs that can be injected into this template */
  availableBugs: BugDef[]
  /** Generate random input data appropriate for this template */
  generateInput(): TemplateInput
  /** Return the buggy code string for the agent to see */
  buggyCode(input: TemplateInput, activeBugs: BugDef[]): string
  /** Compute the correct output (from the un-bugged version) */
  correctOutput(input: TemplateInput): Promise<string>
}

interface TemplateInput {
  /** Base64-encoded input data */
  data: string
  /** Any extra parameters (e.g. rounds) */
  params: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Template 1: Byte Transform
// ---------------------------------------------------------------------------
// Correct: (data[i] * (i + 1)) % 256
// Bug (off_by_one): % 255
// Bug (wrong_shift): uses (i + 1) << 7 instead of * (i + 1) — subtle bit shift error

const byteTransformTemplate: CodeTemplate = {
  name: 'byte_transform',
  availableBugs: [BUG_OFF_BY_ONE, BUG_WRONG_SHIFT],

  generateInput(): TemplateInput {
    const size = randomInt(8, 16)
    const data = randomBytes(size)
    return {
      data: Buffer.from(data).toString('base64'),
      params: {},
    }
  },

  buggyCode(input: TemplateInput, activeBugs: BugDef[]): string {
    const hasOffByOne = activeBugs.some((b) => b.name === 'off_by_one')
    const hasWrongShift = activeBugs.some((b) => b.name === 'wrong_shift')
    const mod = hasOffByOne ? '255' : '256'
    const multiplier = hasWrongShift
      ? '((i + 1) << 7)'
      : '(i + 1)'

    return [
      `function transform(data) {`,
      `  // data is a Uint8Array`,
      `  const result = [];`,
      `  for (let i = 0; i < data.length; i++) {`,
      `    result.push((data[i] * ${multiplier}) % ${mod});`,
      `  }`,
      `  // Return the SHA-256 hex digest of the resulting byte array`,
      `  return sha256hex(Uint8Array.from(result));`,
      `}`,
    ].join('\n')
  },

  async correctOutput(input: TemplateInput): Promise<string> {
    const data = new Uint8Array(Buffer.from(input.data, 'base64'))
    const result: number[] = []
    for (let i = 0; i < data.length; i++) {
      result.push((data[i] * (i + 1)) % 256)
    }
    return sha256Hex(Uint8Array.from(result))
  },
}

// ---------------------------------------------------------------------------
// Template 2: Array Processing (accumulator)
// ---------------------------------------------------------------------------
// Correct: acc = (acc ^ byte) & 0xFF, starting from 0
// Bug (wrong_operator): uses + instead of ^
// Bug (wrong_init): initializes acc to 1 instead of 0
// Bug (wrong_pad): padStart(1, '0') instead of padStart(2, '0')

const arrayProcessingTemplate: CodeTemplate = {
  name: 'array_processing',
  availableBugs: [BUG_WRONG_OPERATOR, BUG_WRONG_INIT, BUG_WRONG_PAD],

  generateInput(): TemplateInput {
    const size = randomInt(8, 24)
    const data = randomBytes(size)
    return {
      data: Buffer.from(data).toString('base64'),
      params: {},
    }
  },

  buggyCode(input: TemplateInput, activeBugs: BugDef[]): string {
    const hasWrongOp = activeBugs.some((b) => b.name === 'wrong_operator')
    const hasWrongInit = activeBugs.some((b) => b.name === 'wrong_init')
    const hasWrongPad = activeBugs.some((b) => b.name === 'wrong_pad')
    const operator = hasWrongOp ? '+' : '^'
    const initVal = hasWrongInit ? '1' : '0'
    const padLen = hasWrongPad ? '1' : '2'

    return [
      `function process(data) {`,
      `  // data is a Uint8Array`,
      `  let acc = ${initVal};`,
      `  for (const byte of data) {`,
      `    acc = (acc ${operator} byte) & 0xFF;`,
      `  }`,
      `  return acc.toString(16).padStart(${padLen}, '0');`,
      `}`,
    ].join('\n')
  },

  async correctOutput(input: TemplateInput): Promise<string> {
    const data = new Uint8Array(Buffer.from(input.data, 'base64'))
    let acc = 0
    for (const byte of data) {
      acc = (acc ^ byte) & 0xff
    }
    return acc.toString(16).padStart(2, '0')
  },
}

// ---------------------------------------------------------------------------
// Template 3: Hash Chain
// ---------------------------------------------------------------------------
// Correct: hash N rounds, reversing the byte array between each round
// Bug (missing_step): omits the reverse between rounds
// Bug (off_by_one): iterates rounds - 1 times (< rounds - 1 instead of < rounds)

const hashChainTemplate: CodeTemplate = {
  name: 'hash_chain',
  availableBugs: [BUG_MISSING_STEP, BUG_OFF_BY_ONE],

  generateInput(): TemplateInput {
    const size = randomInt(8, 16)
    const data = randomBytes(size)
    const rounds = randomInt(2, 4)
    return {
      data: Buffer.from(data).toString('base64'),
      params: { rounds },
    }
  },

  buggyCode(input: TemplateInput, activeBugs: BugDef[]): string {
    const rounds = input.params.rounds as number
    const hasMissingStep = activeBugs.some((b) => b.name === 'missing_step')
    const hasOffByOne = activeBugs.some((b) => b.name === 'off_by_one')
    const loopEnd = hasOffByOne ? `${rounds} - 1` : `${rounds}`
    const reverseComment = hasMissingStep
      ? `      // (no reversal step)`
      : `      current = current.reverse();`

    return [
      `function hashChain(data, rounds) {`,
      `  // data is a Uint8Array, rounds = ${rounds}`,
      `  let current = data;`,
      `  for (let i = 0; i < ${loopEnd}; i++) {`,
      `    current = sha256(current); // returns Uint8Array`,
      reverseComment,
      `  }`,
      `  return hex(current); // returns hex string`,
      `}`,
    ].join('\n')
  },

  async correctOutput(input: TemplateInput): Promise<string> {
    const data = new Uint8Array(Buffer.from(input.data, 'base64'))
    const rounds = input.params.rounds as number
    let current = data
    for (let i = 0; i < rounds; i++) {
      // sha256 the data
      const hashHex = await sha256Hex(current)
      // Convert hex back to bytes
      const hashBytes = new Uint8Array(hashHex.length / 2)
      for (let j = 0; j < hashHex.length; j += 2) {
        hashBytes[j / 2] = parseInt(hashHex.substring(j, j + 2), 16)
      }
      // Reverse between rounds
      current = hashBytes.reverse()
    }
    return toHex(current)
  },
}

// ---------------------------------------------------------------------------
// All templates
// ---------------------------------------------------------------------------

const ALL_TEMPLATES: CodeTemplate[] = [
  byteTransformTemplate,
  arrayProcessingTemplate,
  hashChainTemplate,
]

// ---------------------------------------------------------------------------
// Difficulty configuration
// ---------------------------------------------------------------------------

interface DifficultyConfig {
  /** Number of bugs to inject */
  bugCount: number
  /** Templates that can be used at this difficulty */
  templateNames: string[]
  /** Additional edge-case description in instructions */
  edgeCaseHint: boolean
}

const DIFFICULTY_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    bugCount: 1,
    templateNames: ['byte_transform', 'array_processing'],
    edgeCaseHint: false,
  },
  medium: {
    bugCount: 1,
    templateNames: ['byte_transform', 'array_processing', 'hash_chain'],
    edgeCaseHint: false,
  },
  hard: {
    bugCount: 2,
    templateNames: ['byte_transform', 'array_processing', 'hash_chain'],
    edgeCaseHint: false,
  },
  adversarial: {
    bugCount: 3,
    templateNames: ['byte_transform', 'array_processing', 'hash_chain'],
    edgeCaseHint: true,
  },
}

// ---------------------------------------------------------------------------
// Bug selection logic
// ---------------------------------------------------------------------------

function selectBugs(template: CodeTemplate, count: number): BugDef[] {
  const available = [...template.availableBugs]
  const selected: BugDef[] = []

  const toSelect = Math.min(count, available.length)
  for (let i = 0; i < toSelect; i++) {
    const idx = randomInt(0, available.length - 1)
    selected.push(available[idx])
    available.splice(idx, 1)
  }

  return selected
}

// ---------------------------------------------------------------------------
// CodeExecutionDriver
// ---------------------------------------------------------------------------

export class CodeExecutionDriver implements ChallengeDriver {
  name = 'code-execution'
  dimensions = ['reasoning', 'execution'] as const
  estimatedHumanTimeMs = 120_000
  estimatedAiTimeMs = 2_000

  async generate(difficulty: Difficulty): Promise<ChallengePayload> {
    const config = DIFFICULTY_CONFIG[difficulty]

    // Pick a template
    const eligibleTemplates = ALL_TEMPLATES.filter((t) =>
      config.templateNames.includes(t.name),
    )
    const template = pickRandom(eligibleTemplates)

    // Generate input
    const input = template.generateInput()

    // Select bugs
    const bugs = selectBugs(template, config.bugCount)

    // Generate buggy code
    const buggyCode = template.buggyCode(input, bugs)

    // Pre-compute correct output
    const correctOutput = await template.correctOutput(input)

    // Decode the input data for display
    const inputBytes = new Uint8Array(Buffer.from(input.data, 'base64'))
    const inputHex = toHex(inputBytes)

    // Build instructions
    const paramLines: string[] = []
    if (input.params.rounds !== undefined) {
      paramLines.push(`Rounds: ${input.params.rounds}`)
    }

    const edgeCaseNote = config.edgeCaseHint
      ? '\n\nNote: Pay close attention to boundary conditions, operator precedence, and off-by-one errors.'
      : ''

    const instructions = [
      `The following JavaScript function contains bug(s). Your task is to:`,
      `1. Identify and fix all bugs in the code`,
      `2. Mentally execute the fixed code with the provided input`,
      `3. Return the correct output`,
      ``,
      `## Code`,
      '```javascript',
      buggyCode,
      '```',
      ``,
      `## Input`,
      `Data (hex): ${inputHex}`,
      ...(paramLines.length > 0 ? paramLines.map((l) => l) : []),
      ``,
      `## Notes`,
      `- sha256hex() / sha256() compute SHA-256 and return hex string / Uint8Array respectively`,
      `- hex() converts a Uint8Array to a hex string`,
      `- All arithmetic on bytes should stay within 0-255 range`,
      edgeCaseNote,
      ``,
      `Return the exact output of the fixed function.`,
    ].join('\n')

    return {
      type: 'code-execution',
      instructions,
      data: input.data,
      steps: bugs.length,
      context: {
        templateName: template.name,
        bugs: bugs.map((b) => ({ name: b.name, description: b.description })),
        correctOutput,
        inputParams: input.params,
      },
    }
  }

  /**
   * Solve the challenge by returning the pre-computed correct output.
   * This is used internally for testing.
   */
  async solve(payload: ChallengePayload): Promise<string> {
    const ctx = payload.context as {
      correctOutput: string
    }
    return ctx.correctOutput
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
