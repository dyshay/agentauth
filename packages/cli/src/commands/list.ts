import { Command } from 'commander'
import { RegistryManager } from '@xagentauth/core'

export const listCommand = new Command('list')
  .description('List installed challenge packages')
  .option('--json', 'Output as JSON', false)
  .action(async (options) => {
    const registry = new RegistryManager()
    await registry.init()
    const packages = await registry.list()

    if (packages.length === 0) {
      console.log('\n  No packages installed.\n')
      return
    }

    if (options.json) {
      console.log(JSON.stringify(packages, null, 2))
    } else {
      console.log(`\n  Installed packages (${packages.length}):\n`)
      for (const pkg of packages) {
        console.log(`  ${pkg.manifest.name}@${pkg.manifest.version}`)
        console.log(`    ${pkg.manifest.description}`)
        console.log(`    Dimensions: ${pkg.manifest.dimensions.join(', ')}`)
        console.log()
      }
    }
  })
