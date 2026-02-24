import type { Canary, ModelIdentification, CanaryEvidence } from '../types.js'
import { CanaryExtractor } from './extractor.js'

export interface ClassifierOptions {
  confidenceThreshold?: number // default 0.5
}

export class ModelClassifier {
  private modelFamilies: string[]
  private confidenceThreshold: number
  private extractor: CanaryExtractor

  constructor(modelFamilies: string[], options?: ClassifierOptions) {
    this.modelFamilies = modelFamilies
    this.confidenceThreshold = options?.confidenceThreshold ?? 0.5
    this.extractor = new CanaryExtractor()
  }

  classify(
    canaries: Canary[],
    canaryResponses: Record<string, string> | undefined,
  ): ModelIdentification {
    if (!canaryResponses || canaries.length === 0) {
      return { family: 'unknown', confidence: 0, evidence: [], alternatives: [] }
    }

    const evidence = this.extractor.extract(canaries, canaryResponses)
    if (evidence.length === 0) {
      return { family: 'unknown', confidence: 0, evidence: [], alternatives: [] }
    }

    // Initialize uniform prior
    const posteriors = new Map<string, number>()
    for (const family of this.modelFamilies) {
      posteriors.set(family, 1 / this.modelFamilies.length)
    }

    // Bayesian update for each canary with a response
    for (const canary of canaries) {
      const response = canaryResponses[canary.id]
      if (response === undefined) continue

      for (const family of this.modelFamilies) {
        const prior = posteriors.get(family)!
        const likelihood = this.computeLikelihood(canary, response, family)
        posteriors.set(family, prior * likelihood)
      }

      // Normalize after each update to prevent underflow
      this.normalize(posteriors)
    }

    // Find the best hypothesis
    let bestFamily = 'unknown'
    let bestConfidence = 0

    for (const [family, posterior] of posteriors) {
      if (posterior > bestConfidence) {
        bestConfidence = posterior
        bestFamily = family
      }
    }

    // Build alternatives (sorted descending, excluding best)
    const alternatives: Array<{ family: string; confidence: number }> = []
    for (const [family, posterior] of posteriors) {
      if (family !== bestFamily) {
        alternatives.push({
          family,
          confidence: Math.round(posterior * 1000) / 1000,
        })
      }
    }
    alternatives.sort((a, b) => b.confidence - a.confidence)

    // Apply confidence threshold
    if (bestConfidence < this.confidenceThreshold) {
      return {
        family: 'unknown',
        confidence: Math.round(bestConfidence * 1000) / 1000,
        evidence,
        alternatives: [
          { family: bestFamily, confidence: Math.round(bestConfidence * 1000) / 1000 },
          ...alternatives,
        ],
      }
    }

    return {
      family: bestFamily,
      confidence: Math.round(bestConfidence * 1000) / 1000,
      evidence,
      alternatives,
    }
  }

  private computeLikelihood(canary: Canary, response: string, family: string): number {
    const weight = canary.confidence_weight

    switch (canary.analysis.type) {
      case 'exact_match': {
        const expected = canary.analysis.expected[family]
        if (!expected) return 0.5 // no data for this family
        const isMatch = response.trim().toLowerCase() === expected.trim().toLowerCase()
        // High likelihood if match, low if not, weighted by confidence
        return isMatch ? 0.5 + 0.5 * weight : 0.5 - 0.4 * weight
      }

      case 'pattern': {
        const pattern = canary.analysis.patterns[family]
        if (!pattern) return 0.5
        try {
          const regex = new RegExp(pattern, 'i')
          const isMatch = regex.test(response)
          return isMatch ? 0.5 + 0.45 * weight : 0.5 - 0.35 * weight
        } catch {
          return 0.5
        }
      }

      case 'statistical': {
        const dist = canary.analysis.distributions[family]
        if (!dist) return 0.5
        // Extract first number from response
        const numMatch = response.match(/-?\d+\.?\d*/)
        if (!numMatch) return 0.5
        const value = parseFloat(numMatch[0])
        // Gaussian PDF relative to distribution
        const pdf = this.gaussianPdf(value, dist.mean, dist.stddev)
        // Scale to a likelihood between 0.1 and 0.9
        const maxPdf = this.gaussianPdf(dist.mean, dist.mean, dist.stddev)
        const normalizedPdf = pdf / maxPdf // 0 to 1
        return 0.1 + 0.8 * normalizedPdf * weight
      }
    }
  }

  private gaussianPdf(x: number, mean: number, stddev: number): number {
    const z = (x - mean) / stddev
    return Math.exp(-0.5 * z * z) / (stddev * Math.sqrt(2 * Math.PI))
  }

  private normalize(posteriors: Map<string, number>): void {
    let sum = 0
    for (const v of posteriors.values()) sum += v
    if (sum === 0) {
      // Reset to uniform
      for (const key of posteriors.keys()) {
        posteriors.set(key, 1 / posteriors.size)
      }
      return
    }
    for (const [key, val] of posteriors) {
      posteriors.set(key, val / sum)
    }
  }
}
