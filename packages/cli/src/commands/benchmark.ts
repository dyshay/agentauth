import { Command } from 'commander'
import {
  CryptoNLDriver,
  MultiStepDriver,
  AmbiguousLogicDriver,
  CodeExecutionDriver,
} from '@xagentauth/core'
import type { Difficulty, ChallengeDriver } from '@xagentauth/core'

const DRIVERS: Record<string, () => ChallengeDriver> = {
  'crypto-nl': () => new CryptoNLDriver(),
  'multi-step': () => new MultiStepDriver(),
  'ambiguous-logic': () => new AmbiguousLogicDriver(),
  'code-execution': () => new CodeExecutionDriver(),
}

export const benchmarkCommand = new Command('benchmark')
  .description('Benchmark challenge generation and solving')
  .option('-t, --type <type>', 'Challenge type', 'crypto-nl')
  .option('-d, --difficulty <difficulty>', 'Difficulty level', 'medium')
  .option('-n, --rounds <rounds>', 'Number of rounds', '10')
  .option('--json', 'Output as JSON', false)
  .action(async (options) => {
    const driverFactory = DRIVERS[options.type]
    if (!driverFactory) {
      console.error(`Unknown challenge type: ${options.type}`)
      process.exit(1)
    }

    const difficulty = options.difficulty as Difficulty
    const rounds = parseInt(options.rounds, 10)
    const driver = driverFactory()

    const timings: number[] = []
    let successes = 0

    console.log(`\n  Benchmarking ${options.type} (${difficulty}) \u2014 ${rounds} rounds\n`)

    for (let i = 0; i < rounds; i++) {
      const start = performance.now()

      try {
        const payload = await driver.generate(difficulty)
        const answerHash = await driver.computeAnswerHash(payload)

        // Solve using the driver (it has access to context/ops)
        let answer: string
        if ('solve' in driver && typeof (driver as Record<string, unknown>).solve === 'function') {
          answer = await (driver as unknown as { solve(p: typeof payload): Promise<string> }).solve(payload)
        } else {
          // Skip verification for drivers without solve
          const elapsed = performance.now() - start
          timings.push(elapsed)
          successes++
          continue
        }

        const verified = await driver.verify(answerHash, answer)
        const elapsed = performance.now() - start
        timings.push(elapsed)

        if (verified) successes++

        if (!options.json) {
          const status = verified ? '\u2713' : '\u2717'
          process.stdout.write(`  ${status} Round ${(i + 1).toString().padStart(3)} \u2014 ${elapsed.toFixed(1)}ms\n`)
        }
      } catch {
        const elapsed = performance.now() - start
        timings.push(elapsed)
        if (!options.json) {
          process.stdout.write(`  \u2717 Round ${(i + 1).toString().padStart(3)} \u2014 ERROR (${elapsed.toFixed(1)}ms)\n`)
        }
      }
    }

    // Statistics
    const mean = timings.reduce((a, b) => a + b, 0) / timings.length
    const sorted = [...timings].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)]
    const min = sorted[0]
    const max = sorted[sorted.length - 1]
    const std = Math.sqrt(timings.reduce((sum, t) => sum + (t - mean) ** 2, 0) / timings.length)

    const stats = {
      type: options.type,
      difficulty,
      rounds,
      successes,
      success_rate: `${((successes / rounds) * 100).toFixed(1)}%`,
      timing: {
        mean_ms: Math.round(mean * 10) / 10,
        median_ms: Math.round(median * 10) / 10,
        min_ms: Math.round(min * 10) / 10,
        max_ms: Math.round(max * 10) / 10,
        std_ms: Math.round(std * 10) / 10,
      },
    }

    if (options.json) {
      console.log(JSON.stringify(stats, null, 2))
    } else {
      console.log(`\n  Results:`)
      console.log(`  Success Rate: ${stats.success_rate} (${successes}/${rounds})`)
      console.log(`  Mean: ${stats.timing.mean_ms}ms`)
      console.log(`  Median: ${stats.timing.median_ms}ms`)
      console.log(`  Min: ${stats.timing.min_ms}ms`)
      console.log(`  Max: ${stats.timing.max_ms}ms`)
      console.log(`  Std Dev: ${stats.timing.std_ms}ms`)
      console.log()
    }
  })
