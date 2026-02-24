import type { TimingBaseline, TimingAnalysis, TimingConfig, TimingZone, TimingPatternAnalysis, Difficulty } from '../types.js'
import { DEFAULT_BASELINES } from './baselines.js'

export class TimingAnalyzer {
  private baselines: Map<string, TimingBaseline>
  private defaults: {
    tooFast: number
    aiLower: number
    aiUpper: number
    human: number
    timeout: number
  }

  constructor(config?: TimingConfig) {
    this.baselines = new Map()

    const allBaselines = config?.baselines ?? DEFAULT_BASELINES
    for (const b of allBaselines) {
      this.baselines.set(`${b.challenge_type}:${b.difficulty}`, b)
    }

    this.defaults = {
      tooFast: config?.defaultTooFastMs ?? 50,
      aiLower: config?.defaultAiLowerMs ?? 50,
      aiUpper: config?.defaultAiUpperMs ?? 2000,
      human: config?.defaultHumanMs ?? 10000,
      timeout: config?.defaultTimeoutMs ?? 30000,
    }
  }

  analyze(params: {
    elapsed_ms: number
    challenge_type: string
    difficulty: Difficulty
  }): TimingAnalysis {
    const baseline = this.baselines.get(`${params.challenge_type}:${params.difficulty}`)
      ?? this.makeDefaultBaseline()

    const zone = this.classifyZone(params.elapsed_ms, baseline)
    const penalty = this.computePenalty(zone, params.elapsed_ms, baseline)
    const z_score = this.computeZScore(params.elapsed_ms, baseline)
    const confidence = this.computeConfidence(params.elapsed_ms, baseline, zone)

    return {
      elapsed_ms: params.elapsed_ms,
      zone,
      confidence,
      z_score: Math.round(z_score * 100) / 100,
      penalty: Math.round(penalty * 1000) / 1000,
      details: this.describeZone(zone, params.elapsed_ms, baseline),
    }
  }

  analyzePattern(stepTimings: number[]): TimingPatternAnalysis {
    if (stepTimings.length < 2) {
      return {
        variance_coefficient: 0,
        trend: 'constant',
        round_number_ratio: 0,
        verdict: 'inconclusive',
      }
    }

    const mean = stepTimings.reduce((a, b) => a + b, 0) / stepTimings.length
    const std = Math.sqrt(
      stepTimings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / stepTimings.length,
    )
    const variance_coefficient = mean > 0 ? std / mean : 0

    const trend = this.detectTrend(stepTimings)

    // Round number detection: multiples of 100ms or 500ms
    const roundCount = stepTimings.filter(
      (t) => t % 500 === 0 || (t % 100 === 0 && t % 500 !== 0),
    ).length
    const round_number_ratio = roundCount / stepTimings.length

    // Verdict
    let verdict: 'natural' | 'artificial' | 'inconclusive'
    if (variance_coefficient < 0.05 && stepTimings.length >= 3) {
      verdict = 'artificial' // too consistent = scripted
    } else if (round_number_ratio > 0.5) {
      verdict = 'artificial' // too many round numbers = artificial delays
    } else if (variance_coefficient > 0.1) {
      verdict = 'natural'
    } else {
      verdict = 'inconclusive'
    }

    return {
      variance_coefficient: Math.round(variance_coefficient * 1000) / 1000,
      trend,
      round_number_ratio: Math.round(round_number_ratio * 100) / 100,
      verdict,
    }
  }

  private makeDefaultBaseline(): TimingBaseline {
    return {
      challenge_type: 'default',
      difficulty: 'medium',
      mean_ms: (this.defaults.aiLower + this.defaults.aiUpper) / 2,
      std_ms: (this.defaults.aiUpper - this.defaults.aiLower) / 4,
      too_fast_ms: this.defaults.tooFast,
      ai_lower_ms: this.defaults.aiLower,
      ai_upper_ms: this.defaults.aiUpper,
      human_ms: this.defaults.human,
      timeout_ms: this.defaults.timeout,
    }
  }

  private classifyZone(elapsed: number, baseline: TimingBaseline): TimingZone {
    if (elapsed < baseline.too_fast_ms) return 'too_fast'
    if (elapsed >= baseline.too_fast_ms && elapsed <= baseline.ai_upper_ms) return 'ai_zone'
    if (elapsed > baseline.ai_upper_ms && elapsed <= baseline.human_ms) return 'suspicious'
    if (elapsed > baseline.human_ms && elapsed <= baseline.timeout_ms) return 'human'
    return 'timeout'
  }

  private computePenalty(zone: TimingZone, elapsed: number, baseline: TimingBaseline): number {
    switch (zone) {
      case 'too_fast':
        return 1.0
      case 'ai_zone':
        return 0.0
      case 'suspicious': {
        // Linear interpolation from 0.3 to 0.7 across the suspicious zone
        const range = baseline.human_ms - baseline.ai_upper_ms
        if (range <= 0) return 0.5
        const position = (elapsed - baseline.ai_upper_ms) / range
        return 0.3 + position * 0.4
      }
      case 'human':
        return 0.9
      case 'timeout':
        return 1.0
    }
  }

  private computeZScore(elapsed: number, baseline: TimingBaseline): number {
    if (baseline.std_ms === 0) return 0
    return (elapsed - baseline.mean_ms) / baseline.std_ms
  }

  private computeConfidence(elapsed: number, baseline: TimingBaseline, zone: TimingZone): number {
    // Confidence is higher when elapsed is clearly in a zone (far from boundaries)
    switch (zone) {
      case 'too_fast': {
        // Closer to 0 = more confident it's scripted
        const ratio = elapsed / baseline.too_fast_ms
        return Math.max(0.5, 1 - ratio)
      }
      case 'ai_zone': {
        // More confident when closer to mean
        const distFromMean = Math.abs(elapsed - baseline.mean_ms)
        const normalizedDist = distFromMean / baseline.std_ms
        return Math.max(0.5, Math.min(1, 1 - normalizedDist * 0.15))
      }
      case 'suspicious': {
        // Less confident -- it's ambiguous
        return 0.4 + 0.2 * ((elapsed - baseline.ai_upper_ms) / (baseline.human_ms - baseline.ai_upper_ms))
      }
      case 'human':
        return 0.8
      case 'timeout':
        return 0.95
    }
  }

  private describeZone(zone: TimingZone, elapsed: number, baseline: TimingBaseline): string {
    const ms = Math.round(elapsed)
    switch (zone) {
      case 'too_fast':
        return `Response time ${ms}ms is below ${baseline.too_fast_ms}ms threshold — likely pre-computed or scripted`
      case 'ai_zone':
        return `Response time ${ms}ms is within expected AI range [${baseline.ai_lower_ms}ms, ${baseline.ai_upper_ms}ms]`
      case 'suspicious':
        return `Response time ${ms}ms exceeds AI range — possible human assistance`
      case 'human':
        return `Response time ${ms}ms exceeds ${baseline.human_ms}ms — likely human solver`
      case 'timeout':
        return `Response time ${ms}ms exceeds timeout threshold of ${baseline.timeout_ms}ms`
    }
  }

  private detectTrend(timings: number[]): 'constant' | 'increasing' | 'decreasing' | 'variable' {
    if (timings.length < 3) return 'variable'

    // Simple linear regression slope
    const n = timings.length
    const xMean = (n - 1) / 2
    const yMean = timings.reduce((a, b) => a + b, 0) / n

    let numerator = 0
    let denominator = 0
    for (let i = 0; i < n; i++) {
      numerator += (i - xMean) * (timings[i] - yMean)
      denominator += (i - xMean) ** 2
    }

    if (denominator === 0) return 'constant'
    const slope = numerator / denominator

    // Normalize slope relative to mean
    const normalizedSlope = yMean > 0 ? slope / yMean : 0

    if (Math.abs(normalizedSlope) < 0.05) return 'constant'
    if (normalizedSlope > 0.1) return 'increasing'
    if (normalizedSlope < -0.1) return 'decreasing'
    return 'variable'
  }
}
