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

export const generateCommand = new Command('generate')
  .description('Generate a challenge locally')
  .option('-t, --type <type>', 'Challenge type', 'crypto-nl')
  .option('-d, --difficulty <difficulty>', 'Difficulty level', 'medium')
  .option('--json', 'Output as JSON', false)
  .action(async (options) => {
    const driverFactory = DRIVERS[options.type]
    if (!driverFactory) {
      console.error(`Unknown challenge type: ${options.type}`)
      console.error(`Available types: ${Object.keys(DRIVERS).join(', ')}`)
      process.exit(1)
    }

    const difficulty = options.difficulty as Difficulty
    const driver = driverFactory()
    const payload = await driver.generate(difficulty)

    if (options.json) {
      console.log(JSON.stringify(payload, null, 2))
    } else {
      console.log(`\n  Challenge Type: ${payload.type}`)
      console.log(`  Difficulty: ${difficulty}`)
      console.log(`  Steps: ${payload.steps}`)
      console.log(`\n  Instructions:`)
      console.log(`  ${payload.instructions.split('\n').join('\n  ')}`)
      console.log(`\n  Data: ${payload.data.substring(0, 64)}${payload.data.length > 64 ? '...' : ''}`)
      console.log()
    }
  })
