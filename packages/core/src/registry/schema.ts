import { z } from 'zod'

export const ChallengeManifestSchema = z.object({
  name: z.string().min(1).regex(/^@?[\w-]+\/[\w-]+$/, 'Must be scoped: @scope/name or scope/name'),
  version: z.string().regex(/^\d+\.\d+\.\d+/, 'Must be valid semver'),
  description: z.string().min(1),
  author: z.string().min(1),
  dimensions: z.array(z.enum(['reasoning', 'execution', 'memory', 'ambiguity'])).min(1),
  difficulties: z.array(z.enum(['easy', 'medium', 'hard', 'adversarial'])).min(1),
  entry: z.string().min(1),
  agentauth_version: z.string().min(1),
  license: z.string().optional(),
  repository: z.string().url().optional(),
  keywords: z.array(z.string()).optional(),
})

export const RegistryIndexSchema = z.object({
  version: z.string(),
  packages: z.record(z.string(), z.object({
    manifest: ChallengeManifestSchema,
    installed_at: z.string(),
    path: z.string(),
  })),
})
