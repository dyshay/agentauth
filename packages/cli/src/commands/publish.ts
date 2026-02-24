import { Command } from 'commander'
import { RegistryManager } from '@xagentauth/core'
import { resolve } from 'node:path'

export const publishCommand = new Command('publish')
  .description('Validate and prepare a challenge package for publishing')
  .argument('[dir]', 'Package directory', '.')
  .option('--dry-run', 'Validate only, do not publish', false)
  .action(async (dir: string, options) => {
    const sourceDir = resolve(dir)
    const registry = new RegistryManager()

    const validation = await registry.validatePackage(sourceDir)
    if (!validation.valid) {
      console.error('\n  Validation failed:')
      for (const err of validation.errors) {
        console.error(`    - ${err}`)
      }
      process.exit(1)
    }

    console.log('\n  Package is valid!')

    if (options.dryRun) {
      console.log('  (dry run — no publish)\n')
      return
    }

    console.log('  Remote registry not yet available. Use `agentauth add <dir>` for local install.\n')
  })
