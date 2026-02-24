import type { Canary, CanaryEvidence, CanaryAnalysisExactMatch, CanaryAnalysisPattern, CanaryAnalysisStatistical } from '../types.js'

export class CanaryExtractor {
  extract(injectedCanaries: Canary[], canaryResponses: Record<string, string> | undefined): CanaryEvidence[] {
    if (!canaryResponses) return []

    const evidence: CanaryEvidence[] = []

    for (const canary of injectedCanaries) {
      const response = canaryResponses[canary.id]
      if (response === undefined) continue

      const result = this.evaluate(canary, response)
      evidence.push(result)
    }

    return evidence
  }

  private evaluate(canary: Canary, observed: string): CanaryEvidence {
    switch (canary.analysis.type) {
      case 'exact_match':
        return this.evaluateExactMatch(canary, canary.analysis, observed)
      case 'pattern':
        return this.evaluatePattern(canary, canary.analysis, observed)
      case 'statistical':
        return this.evaluateStatistical(canary, canary.analysis, observed)
    }
  }

  private evaluateExactMatch(canary: Canary, analysis: CanaryAnalysisExactMatch, observed: string): CanaryEvidence {
    // Check if observed matches any model's expected value
    let bestMatch = ''
    let match = false

    for (const [_family, expected] of Object.entries(analysis.expected)) {
      if (observed.trim().toLowerCase() === expected.trim().toLowerCase()) {
        bestMatch = expected
        match = true
        break
      }
    }

    // If no match, use the first expected value as reference
    if (!match) {
      bestMatch = Object.values(analysis.expected)[0] ?? ''
    }

    return {
      canary_id: canary.id,
      observed,
      expected: bestMatch,
      match,
      confidence_contribution: match ? canary.confidence_weight : canary.confidence_weight * 0.3,
    }
  }

  private evaluatePattern(canary: Canary, analysis: CanaryAnalysisPattern, observed: string): CanaryEvidence {
    let bestPattern = ''
    let match = false

    for (const [_family, pattern] of Object.entries(analysis.patterns)) {
      try {
        const regex = new RegExp(pattern, 'i')
        if (regex.test(observed)) {
          bestPattern = pattern
          match = true
          break
        }
      } catch {
        // Invalid regex, skip
      }
    }

    if (!match) {
      bestPattern = Object.values(analysis.patterns)[0] ?? ''
    }

    return {
      canary_id: canary.id,
      observed,
      expected: bestPattern,
      match,
      confidence_contribution: match ? canary.confidence_weight : canary.confidence_weight * 0.2,
    }
  }

  private evaluateStatistical(canary: Canary, analysis: CanaryAnalysisStatistical, observed: string): CanaryEvidence {
    // For statistical canaries, we parse the observed value and check if it's
    // within a reasonable range for any model's distribution
    // For now, extract the first number from the response
    const numMatch = observed.match(/-?\d+\.?\d*/)
    const numValue = numMatch ? parseFloat(numMatch[0]) : NaN

    let bestDist = ''
    let match = false

    if (!isNaN(numValue)) {
      for (const [family, dist] of Object.entries(analysis.distributions)) {
        // Within 2 standard deviations
        if (Math.abs(numValue - dist.mean) <= 2 * dist.stddev) {
          bestDist = `${family}: mean=${dist.mean}, stddev=${dist.stddev}`
          match = true
          break
        }
      }
    }

    if (!match) {
      const first = Object.entries(analysis.distributions)[0]
      bestDist = first ? `${first[0]}: mean=${first[1].mean}, stddev=${first[1].stddev}` : ''
    }

    return {
      canary_id: canary.id,
      observed,
      expected: bestDist,
      match,
      confidence_contribution: match ? canary.confidence_weight * 0.7 : canary.confidence_weight * 0.1,
    }
  }
}
