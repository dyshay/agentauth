import type { TimingZone, SessionTimingAnomaly } from '../types.js'

interface SessionEntry {
  elapsed_ms: number
  zone: TimingZone
  timestamp: number
}

export class SessionTimingTracker {
  private sessions = new Map<string, SessionEntry[]>()

  record(sessionId: string, elapsedMs: number, zone: TimingZone): void {
    const entries = this.sessions.get(sessionId) ?? []
    entries.push({ elapsed_ms: elapsedMs, zone, timestamp: Date.now() })
    this.sessions.set(sessionId, entries)
  }

  analyze(sessionId: string): SessionTimingAnomaly[] {
    const entries = this.sessions.get(sessionId)
    if (!entries || entries.length < 2) return []

    const anomalies: SessionTimingAnomaly[] = []

    // Check zone inconsistency: agent oscillates between ai_zone and human
    const zones = entries.map((e) => e.zone)
    const aiCount = zones.filter((z) => z === 'ai_zone').length
    const humanCount = zones.filter((z) => z === 'human' || z === 'suspicious').length
    if (aiCount > 0 && humanCount > 0 && entries.length >= 3) {
      anomalies.push({
        type: 'zone_inconsistency',
        description: `Session oscillates between AI zone (${aiCount}x) and human/suspicious zone (${humanCount}x) across ${entries.length} challenges`,
        severity: humanCount >= aiCount ? 'high' : 'medium',
      })
    }

    // Check timing variance: too consistent across sessions (scripted)
    if (entries.length >= 3) {
      const timings = entries.map((e) => e.elapsed_ms)
      const mean = timings.reduce((a, b) => a + b, 0) / timings.length
      if (mean > 0) {
        const std = Math.sqrt(
          timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length,
        )
        const cv = std / mean
        if (cv < 0.05) {
          anomalies.push({
            type: 'timing_variance_anomaly',
            description: `Timing variance coefficient ${(cv * 100).toFixed(1)}% is suspiciously low across ${entries.length} challenges`,
            severity: 'high',
          })
        }
      }
    }

    // Check rapid succession: multiple challenges in < 5s
    for (let i = 1; i < entries.length; i++) {
      const gap = entries[i].timestamp - entries[i - 1].timestamp
      if (gap < 5000) {
        anomalies.push({
          type: 'rapid_succession',
          description: `Challenges ${i - 1} and ${i} completed ${gap}ms apart (< 5000ms threshold)`,
          severity: gap < 2000 ? 'high' : 'low',
        })
        break // Only report once
      }
    }

    return anomalies
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId)
  }
}
