import { describe, it, expect } from 'vitest'
import { ChallengeManifestSchema, RegistryIndexSchema } from '../registry/schema.js'

const VALID_MANIFEST = {
  name: '@community/chess-puzzle',
  version: '1.0.0',
  description: 'Chess puzzle challenge driver',
  author: 'chess-enthusiast',
  dimensions: ['reasoning', 'execution'] as const,
  difficulties: ['easy', 'medium', 'hard'] as const,
  entry: 'src/index.ts',
  agentauth_version: '>=1.0.0',
}

describe('ChallengeManifestSchema', () => {
  it('validates a correct manifest', () => {
    const result = ChallengeManifestSchema.safeParse(VALID_MANIFEST)
    expect(result.success).toBe(true)
  })

  it('validates manifest with all optional fields', () => {
    const result = ChallengeManifestSchema.safeParse({
      ...VALID_MANIFEST,
      license: 'MIT',
      repository: 'https://github.com/example/chess-puzzle',
      keywords: ['chess', 'puzzle', 'reasoning'],
    })
    expect(result.success).toBe(true)
  })

  it('rejects name without scope', () => {
    const result = ChallengeManifestSchema.safeParse({
      ...VALID_MANIFEST,
      name: 'chess-puzzle',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid semver', () => {
    const result = ChallengeManifestSchema.safeParse({
      ...VALID_MANIFEST,
      version: 'not-a-version',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty dimensions', () => {
    const result = ChallengeManifestSchema.safeParse({
      ...VALID_MANIFEST,
      dimensions: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid dimension', () => {
    const result = ChallengeManifestSchema.safeParse({
      ...VALID_MANIFEST,
      dimensions: ['invalid'],
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty difficulties', () => {
    const result = ChallengeManifestSchema.safeParse({
      ...VALID_MANIFEST,
      difficulties: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid repository URL', () => {
    const result = ChallengeManifestSchema.safeParse({
      ...VALID_MANIFEST,
      repository: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })
})

describe('RegistryIndexSchema', () => {
  it('validates an empty index', () => {
    const result = RegistryIndexSchema.safeParse({
      version: '1.0.0',
      packages: {},
    })
    expect(result.success).toBe(true)
  })

  it('validates an index with packages', () => {
    const result = RegistryIndexSchema.safeParse({
      version: '1.0.0',
      packages: {
        '@community/chess-puzzle': {
          manifest: VALID_MANIFEST,
          installed_at: '2026-02-24T12:00:00Z',
          path: '/path/to/package',
        },
      },
    })
    expect(result.success).toBe(true)
  })
})
