import { Command } from 'commander'
import { RegistryManager } from '@xagentauth/core'

export const searchCommand = new Command('search')
  .description('Search installed challenge packages')
  .argument('<query>', 'Search query')
  .option('--json', 'Output as JSON', false)
  .action(async (query: string, options) => {
    const registry = new RegistryManager()
    await registry.init()
    const results = await registry.search(query)

    if (results.length === 0) {
      console.log(`\n  No packages matching "${query}".\n`)
      return
    }

    if (options.json) {
      console.log(JSON.stringify(results, null, 2))
    } else {
      console.log(`\n  Found ${results.length} package(s):\n`)
      for (const pkg of results) {
        console.log(`  ${pkg.manifest.name}@${pkg.manifest.version}`)
        console.log(`    ${pkg.manifest.description}\n`)
      }
    }
  })
