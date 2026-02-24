import { z } from 'zod'

export const DifficultySchema = z.enum(['easy', 'medium', 'hard', 'adversarial'])

export const ChallengeDimensionSchema = z.enum([
  'reasoning',
  'execution',
  'memory',
  'ambiguity',
])

const score = z.number().min(0).max(1)

export const AgentCapabilityScoreSchema = z.object({
  reasoning: score,
  execution: score,
  autonomy: score,
  speed: score,
  consistency: score,
})

export const ChallengePayloadSchema = z.object({
  type: z.string(),
  instructions: z.string(),
  data: z.string(),
  steps: z.number().int().positive(),
  context: z.record(z.unknown()).optional(),
})

export const ChallengeSchema = z.object({
  id: z.string(),
  session_token: z.string(),
  payload: ChallengePayloadSchema,
  difficulty: DifficultySchema,
  dimensions: z.array(ChallengeDimensionSchema),
  created_at: z.number(),
  expires_at: z.number(),
})

export const FailReasonSchema = z.enum([
  'wrong_answer',
  'expired',
  'already_used',
  'invalid_hmac',
  'too_fast',
  'too_slow',
  'rate_limited',
])

// --- PoMI Schemas ---

export const InjectionMethodSchema = z.enum(['inline', 'prefix', 'suffix', 'embedded'])

export const DistributionSchema = z.object({
  mean: z.number(),
  stddev: z.number().positive(),
})

export const CanaryAnalysisExactMatchSchema = z.object({
  type: z.literal('exact_match'),
  expected: z.record(z.string()),
})

export const CanaryAnalysisStatisticalSchema = z.object({
  type: z.literal('statistical'),
  distributions: z.record(DistributionSchema),
})

export const CanaryAnalysisPatternSchema = z.object({
  type: z.literal('pattern'),
  patterns: z.record(z.string()),
})

export const CanaryAnalysisSchema = z.discriminatedUnion('type', [
  CanaryAnalysisExactMatchSchema,
  CanaryAnalysisStatisticalSchema,
  CanaryAnalysisPatternSchema,
])

const weight = z.number().min(0).max(1)

export const CanarySchema = z.object({
  id: z.string(),
  prompt: z.string(),
  injection_method: InjectionMethodSchema,
  analysis: CanaryAnalysisSchema,
  confidence_weight: weight,
})

export const ModelSignatureSchema = z.object({
  model_family: z.string(),
  expected_value: z.union([z.string(), z.number()]),
  confidence: weight,
  last_verified: z.string(),
})

export const CanaryEvidenceSchema = z.object({
  canary_id: z.string(),
  observed: z.string(),
  expected: z.string(),
  match: z.boolean(),
  confidence_contribution: z.number(),
})

export const ModelIdentificationSchema = z.object({
  family: z.string(),
  confidence: weight,
  evidence: z.array(CanaryEvidenceSchema),
  alternatives: z.array(z.object({ family: z.string(), confidence: weight })),
})

export const PomiConfigSchema = z.object({
  enabled: z.boolean(),
  canaries: z.array(CanarySchema).optional(),
  canariesPerChallenge: z.number().int().positive().optional(),
  modelFamilies: z.array(z.string()).optional(),
  confidenceThreshold: z.number().min(0).max(1).optional(),
})

// --- Schemas that reference PoMI types ---

export const VerifyResultSchema = z.object({
  success: z.boolean(),
  score: AgentCapabilityScoreSchema,
  token: z.string().optional(),
  reason: FailReasonSchema.optional(),
  model_identity: ModelIdentificationSchema.optional(),
})

export const ChallengeDataSchema = z.object({
  challenge: ChallengeSchema,
  answer_hash: z.string(),
  attempts: z.number().int().min(0),
  max_attempts: z.number().int().positive(),
  created_at: z.number(),
  injected_canaries: z.array(CanarySchema).optional(),
})

export const AgentAuthConfigSchema = z.object({
  secret: z.string().min(1),
  store: z.custom<import('./types.js').ChallengeStore>(),
  drivers: z.array(z.custom<import('./types.js').ChallengeDriver>()).optional(),
  tokenTtlSeconds: z.number().positive().default(3600),
  challengeTtlSeconds: z.number().positive().default(30),
  minScore: z.number().min(0).max(1).default(0.7),
  pomi: PomiConfigSchema.optional(),
})

export const InitChallengeRequestSchema = z.object({
  difficulty: DifficultySchema.default('medium'),
  dimensions: z.array(ChallengeDimensionSchema).optional(),
})

export const SolveChallengeRequestSchema = z.object({
  answer: z.string(),
  hmac: z.string(),
  canary_responses: z.record(z.string()).optional(),
  metadata: z
    .object({
      model: z.string().optional(),
      framework: z.string().optional(),
    })
    .optional(),
})

// --- Timing Analysis Schemas ---

export const TimingZoneSchema = z.enum(['too_fast', 'ai_zone', 'suspicious', 'human', 'timeout'])

export const TimingBaselineSchema = z.object({
  challenge_type: z.string(),
  difficulty: DifficultySchema,
  mean_ms: z.number().positive(),
  std_ms: z.number().positive(),
  too_fast_ms: z.number().nonnegative(),
  ai_lower_ms: z.number().positive(),
  ai_upper_ms: z.number().positive(),
  human_ms: z.number().positive(),
  timeout_ms: z.number().positive(),
})

export const TimingAnalysisSchema = z.object({
  elapsed_ms: z.number().nonnegative(),
  zone: TimingZoneSchema,
  confidence: z.number().min(0).max(1),
  z_score: z.number(),
  penalty: z.number().min(0).max(1),
  details: z.string(),
})

export const TimingPatternAnalysisSchema = z.object({
  variance_coefficient: z.number().nonnegative(),
  trend: z.enum(['constant', 'increasing', 'decreasing', 'variable']),
  round_number_ratio: z.number().min(0).max(1),
  verdict: z.enum(['natural', 'artificial', 'inconclusive']),
})

export const TimingConfigSchema = z.object({
  enabled: z.boolean(),
  baselines: z.array(TimingBaselineSchema).optional(),
  defaultTooFastMs: z.number().positive().optional(),
  defaultAiLowerMs: z.number().positive().optional(),
  defaultAiUpperMs: z.number().positive().optional(),
  defaultHumanMs: z.number().positive().optional(),
  defaultTimeoutMs: z.number().positive().optional(),
})
