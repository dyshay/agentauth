import type { ChallengeDriver, ChallengePayload, Difficulty } from '../types.js'
import { randomBytes, toHex, sha256Hex, timingSafeEqual } from '../crypto.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AcceptableAnswer {
  /** Hex-encoded result bytes */
  answer: string
  /** 0-1, where 1.0 = primary answer */
  score: number
}

interface ScoredAnswerHash {
  answerHash: string
  score: number
}

interface AmbiguousTemplate {
  name: string
  generate(data: Uint8Array, difficulty: Difficulty): {
    instructions: string
    acceptableAnswers: AcceptableAnswer[]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function xorBytes(data: Uint8Array, key: number): Uint8Array {
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[i] ^ (key & 0xff)
  }
  return result
}

function sortAscending(data: Uint8Array): Uint8Array {
  return new Uint8Array([...data].sort((a, b) => a - b))
}

function reverseBytes(data: Uint8Array): Uint8Array {
  const result = new Uint8Array(data.length)
  for (let i = 0; i < data.length; i++) {
    result[i] = data[data.length - 1 - i]
  }
  return result
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

const luckyNumberTemplate: AmbiguousTemplate = {
  name: 'lucky-number',
  generate(data: Uint8Array, difficulty: Difficulty) {
    const byteCount = data.length

    // Primary interpretation: 7 is "the" lucky number
    const isLucky7 = byteCount === 7
    const primaryResult = isLucky7 ? xorBytes(data, 7) : xorBytes(data, 13)

    const alternatives: AcceptableAnswer[] = [
      { answer: toHex(primaryResult), score: 1.0 },
    ]

    // Alternative lucky numbers from various cultures
    const altLuckyNumbers = [3, 8, 13]
    const altScores: Record<number, number> = { 3: 0.6, 8: 0.6, 13: 0.7 }

    if (difficulty !== 'easy') {
      for (const lucky of altLuckyNumbers) {
        const isLucky = byteCount === lucky
        const altResult = isLucky ? xorBytes(data, 7) : xorBytes(data, 13)
        const altHex = toHex(altResult)
        // Only add if it differs from the primary
        if (altHex !== alternatives[0].answer) {
          alternatives.push({ answer: altHex, score: altScores[lucky] })
        }
      }
    }

    const phrasings = [
      `You are given ${byteCount} bytes of data (base64-encoded).\n` +
        `If the number of bytes is a lucky number, XOR each byte with 7.\n` +
        `Otherwise, XOR each byte with 13.\n` +
        `Return the hex-encoded result.`,
      `The data below contains ${byteCount} bytes.\n` +
        `When the byte count is lucky, apply XOR 7 to every byte.\n` +
        `When unlucky, apply XOR 13 instead.\n` +
        `Provide your answer as a hex string.`,
    ]

    return {
      instructions: pickRandom(phrasings),
      acceptableAnswers: alternatives,
    }
  },
}

const famousConstantTemplate: AmbiguousTemplate = {
  name: 'famous-constant',
  generate(data: Uint8Array, _difficulty: Difficulty) {
    // Primary: pi -> "3.1" -> 31
    const piResult = xorBytes(data, 31)
    // Alternative: e -> "2.7" -> 27
    const eResult = xorBytes(data, 27)
    // Alternative: phi -> "1.6" -> 16
    const phiResult = xorBytes(data, 16)

    const alternatives: AcceptableAnswer[] = [
      { answer: toHex(piResult), score: 1.0 },
      { answer: toHex(eResult), score: 0.8 },
      { answer: toHex(phiResult), score: 0.6 },
    ]

    const phrasings = [
      `XOR each byte of the provided data with the most famous mathematical constant's first two digits as an integer.\n` +
        `Return the hex-encoded result.`,
      `Take the universally recognized mathematical constant, extract its first two digits as a whole number, ` +
        `and XOR every byte of the data with that number.\n` +
        `Provide the hex-encoded output.`,
    ]

    return {
      instructions: pickRandom(phrasings),
      acceptableAnswers: alternatives,
    }
  },
}

const bigSmallTemplate: AmbiguousTemplate = {
  name: 'big-small',
  generate(data: Uint8Array, _difficulty: Difficulty) {
    const firstByte = data[0]

    // Primary: "big" means > 127
    const primary127 =
      firstByte > 127 ? reverseBytes(data) : sortAscending(data)

    // Alternative: "big" means > 100
    const alt100 =
      firstByte > 100 ? reverseBytes(data) : sortAscending(data)

    // Alternative: "big" means > 200
    const alt200 =
      firstByte > 200 ? reverseBytes(data) : sortAscending(data)

    const alternatives: AcceptableAnswer[] = [
      { answer: toHex(primary127), score: 1.0 },
    ]

    const alt100Hex = toHex(alt100)
    const alt200Hex = toHex(alt200)

    if (alt100Hex !== alternatives[0].answer) {
      alternatives.push({ answer: alt100Hex, score: 0.8 })
    }
    if (alt200Hex !== alternatives[0].answer && alt200Hex !== alt100Hex) {
      alternatives.push({ answer: alt200Hex, score: 0.7 })
    }

    const phrasings = [
      `If the first byte of the data is big, reverse the entire byte array.\n` +
        `Otherwise, sort all bytes in ascending order.\n` +
        `Return the hex-encoded result.`,
      `Examine the first byte. If it is a big value, flip the array end-to-end.\n` +
        `If it is small, arrange bytes from lowest to highest.\n` +
        `Provide the hex-encoded output.`,
    ]

    return {
      instructions: pickRandom(phrasings),
      acceptableAnswers: alternatives,
    }
  },
}

// ---------------------------------------------------------------------------
// All templates by difficulty
// ---------------------------------------------------------------------------

const ALL_TEMPLATES: AmbiguousTemplate[] = [
  luckyNumberTemplate,
  famousConstantTemplate,
  bigSmallTemplate,
]

/**
 * Difficulty scaling:
 *  - easy:        1 template, 1 ambiguity point, clear primary answer
 *  - medium:      1-2 ambiguity points
 *  - hard:        2-3 ambiguity points chained
 *  - adversarial: 3+ with cultural references
 */
const DIFFICULTY_CONFIG: Record<Difficulty, { dataSize: number; templateCount: number }> = {
  easy: { dataSize: 8, templateCount: 1 },
  medium: { dataSize: 16, templateCount: 1 },
  hard: { dataSize: 32, templateCount: 2 },
  adversarial: { dataSize: 64, templateCount: 3 },
}

// ---------------------------------------------------------------------------
// Driver
// ---------------------------------------------------------------------------

export class AmbiguousLogicDriver implements ChallengeDriver {
  name = 'ambiguous-logic'
  dimensions = ['reasoning', 'ambiguity'] as const
  estimatedHumanTimeMs = 45_000
  estimatedAiTimeMs = 1_000

  async generate(difficulty: Difficulty): Promise<ChallengePayload> {
    const config = DIFFICULTY_CONFIG[difficulty]
    const data = randomBytes(config.dataSize)

    // Pick template(s) based on difficulty
    const selectedTemplates = this.selectTemplates(config.templateCount)

    // For single-template challenges, run the template directly
    // For multi-template (hard/adversarial), chain operations
    if (selectedTemplates.length === 1) {
      return this.generateSingle(selectedTemplates[0], data, difficulty)
    }

    return this.generateChained(selectedTemplates, data, difficulty)
  }

  /**
   * Solve the challenge, returning the hex string of the primary answer.
   */
  async solve(payload: ChallengePayload): Promise<string> {
    const ctx = payload.context as {
      primaryAnswer: string
      scoredAnswers: ScoredAnswerHash[]
    }
    return ctx.primaryAnswer
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

  // -------------------------------------------------------------------------
  // Private helpers
  // -------------------------------------------------------------------------

  private selectTemplates(count: number): AmbiguousTemplate[] {
    const shuffled = [...ALL_TEMPLATES].sort(() => Math.random() - 0.5)
    return shuffled.slice(0, Math.min(count, shuffled.length))
  }

  private async generateSingle(
    template: AmbiguousTemplate,
    data: Uint8Array,
    difficulty: Difficulty,
  ): Promise<ChallengePayload> {
    const result = template.generate(data, difficulty)

    const scoredAnswers = await this.hashAnswers(result.acceptableAnswers)

    return {
      type: 'ambiguous-logic',
      instructions: result.instructions,
      data: Buffer.from(data).toString('base64'),
      steps: 1,
      context: {
        templateName: template.name,
        primaryAnswer: result.acceptableAnswers[0].answer,
        scoredAnswers,
      },
    }
  }

  private async generateChained(
    templates: AmbiguousTemplate[],
    data: Uint8Array,
    difficulty: Difficulty,
  ): Promise<ChallengePayload> {
    // Chain: first template transforms data, second template operates on primary result of first
    // This creates compounding ambiguity
    let currentData = data
    const instructionParts: string[] = []
    let allAcceptable: AcceptableAnswer[] = []

    for (let i = 0; i < templates.length; i++) {
      const template = templates[i]
      const result = template.generate(currentData, difficulty)

      instructionParts.push(`--- Part ${i + 1} ---\n${result.instructions}`)

      if (i === 0) {
        // Seed the acceptable answers from the first template
        allAcceptable = result.acceptableAnswers
      } else {
        // For chained templates, apply the second template to each prior answer
        const chained: AcceptableAnswer[] = []
        for (const prev of allAcceptable) {
          const prevData = fromHex(prev.answer)
          const chainResult = template.generate(prevData, difficulty)
          for (const ans of chainResult.acceptableAnswers) {
            chained.push({
              answer: ans.answer,
              score: prev.score * ans.score, // compound scores
            })
          }
        }
        allAcceptable = chained
      }

      // Use the primary answer as input for the next template
      currentData = fromHex(allAcceptable[0].answer)
    }

    // Deduplicate: keep the highest-scoring version of each unique answer
    const uniqueMap = new Map<string, number>()
    for (const ans of allAcceptable) {
      const existing = uniqueMap.get(ans.answer)
      if (existing === undefined || ans.score > existing) {
        uniqueMap.set(ans.answer, ans.score)
      }
    }
    const deduplicated: AcceptableAnswer[] = [...uniqueMap.entries()]
      .map(([answer, score]) => ({ answer, score }))
      .sort((a, b) => b.score - a.score)

    const scoredAnswers = await this.hashAnswers(deduplicated)

    const fullInstructions =
      `This is a multi-part ambiguous logic challenge.\n` +
      `Apply each part's transformation in order, using the output of the previous part as input for the next.\n\n` +
      instructionParts.join('\n\n')

    return {
      type: 'ambiguous-logic',
      instructions: fullInstructions,
      data: Buffer.from(data).toString('base64'),
      steps: templates.length,
      context: {
        templateNames: templates.map((t) => t.name),
        primaryAnswer: deduplicated[0].answer,
        scoredAnswers,
      },
    }
  }

  private async hashAnswers(
    answers: AcceptableAnswer[],
  ): Promise<ScoredAnswerHash[]> {
    const results: ScoredAnswerHash[] = []
    for (const ans of answers) {
      const hash = await sha256Hex(new TextEncoder().encode(ans.answer))
      results.push({ answerHash: hash, score: ans.score })
    }
    return results
  }
}

// Re-export helper for use by fromHex in chained mode
function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16)
  }
  return bytes
}
