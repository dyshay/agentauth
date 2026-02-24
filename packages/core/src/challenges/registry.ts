import type { ChallengeDriver, ChallengeDimension } from '../types.js'

export interface SelectOptions {
  dimensions?: ChallengeDimension[]
  count?: number
}

export class ChallengeRegistry {
  private drivers = new Map<string, ChallengeDriver>()

  register(driver: ChallengeDriver): void {
    if (this.drivers.has(driver.name)) {
      throw new Error(`Driver "${driver.name}" is already registered`)
    }
    this.drivers.set(driver.name, driver)
  }

  get(name: string): ChallengeDriver | undefined {
    return this.drivers.get(name)
  }

  list(): ChallengeDriver[] {
    return [...this.drivers.values()]
  }

  select(options: SelectOptions): ChallengeDriver[] {
    const all = this.list()
    if (all.length === 0) {
      throw new Error('No challenge drivers registered')
    }

    const count = options.count ?? 1
    const dims = options.dimensions ?? []

    if (dims.length === 0) {
      return all.slice(0, count)
    }

    const scored = all.map((driver) => ({
      driver,
      coverage: driver.dimensions.filter((d) =>
        dims.includes(d as ChallengeDimension),
      ).length,
    }))

    scored.sort((a, b) => b.coverage - a.coverage)
    return scored.slice(0, count).map((s) => s.driver)
  }
}
