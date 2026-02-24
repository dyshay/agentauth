import type { ChallengeDimension, Difficulty } from '../types.js'

export interface ChallengeManifest {
  name: string
  version: string
  description: string
  author: string
  dimensions: ChallengeDimension[]
  difficulties: Difficulty[]
  entry: string
  agentauth_version: string
  license?: string
  repository?: string
  keywords?: string[]
}

export interface InstalledPackage {
  manifest: ChallengeManifest
  installed_at: string
  path: string
}

export interface RegistryIndex {
  version: string
  packages: Record<string, InstalledPackage>
}
