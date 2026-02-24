import { Command } from 'commander'
import { RegistryManager } from '@xagentauth/core'

export const addCommand = new Command('add')
  .description('Install a challenge package from a local directory')
  .argument('<source>', 'Path to the challenge package directory')
  .action(async (source: string) => {
    const registry = new RegistryManager()
    await registry.init()

    const validation = await registry.validatePackage(source)
    if (!validation.valid) {
      console.error('\n  Package validation failed:')
      for (const err of validation.errors) {
        console.error(`    - ${err}`)
      }
      process.exit(1)
    }

    const pkg = await registry.install(source)
    console.log(`\n  Installed ${pkg.manifest.name}@${pkg.manifest.version}`)
    console.log(`  Dimensions: ${pkg.manifest.dimensions.join(', ')}`)
    console.log(`  Difficulties: ${pkg.manifest.difficulties.join(', ')}\n`)
  })
