import { Command } from 'commander'
import { TokenManager } from '@xagentauth/core'

export const verifyCommand = new Command('verify')
  .description('Decode and verify an AgentAuth JWT token')
  .argument('<token>', 'JWT token to verify')
  .option('-s, --secret <secret>', 'Secret key for verification')
  .option('--json', 'Output as JSON', false)
  .action(async (token: string, options) => {
    try {
      // Always decode (doesn't need secret)
      const manager = new TokenManager(options.secret ?? 'dummy')
      const decoded = manager.decode(token)

      if (options.json) {
        console.log(JSON.stringify(decoded, null, 2))
      } else {
        console.log(`\n  Token decoded:`)
        console.log(`  Subject: ${decoded.sub}`)
        console.log(`  Issuer: ${decoded.iss}`)
        console.log(`  Model Family: ${decoded.model_family}`)
        console.log(`  Version: ${decoded.agentauth_version}`)
        if (decoded.iat) console.log(`  Issued At: ${new Date(decoded.iat * 1000).toISOString()}`)
        if (decoded.exp) console.log(`  Expires At: ${new Date(decoded.exp * 1000).toISOString()}`)
        if (decoded.capabilities) {
          console.log(`  Capabilities:`)
          for (const [key, value] of Object.entries(decoded.capabilities)) {
            const bar = '\u2588'.repeat(Math.round((value as number) * 20)).padEnd(20, '\u2591')
            console.log(`    ${key.padEnd(12)} ${bar}  ${(value as number).toFixed(2)}`)
          }
        }
        console.log()
      }

      // Verify signature if secret provided
      if (options.secret) {
        try {
          await manager.verify(token)
          console.log('  \u2713 Signature valid\n')
        } catch {
          console.log('  \u2717 Signature invalid or token expired\n')
        }
      } else {
        console.log('  (provide --secret to verify signature)\n')
      }
    } catch (err) {
      console.error(`Failed to decode token: ${err instanceof Error ? err.message : err}`)
      process.exit(1)
    }
  })
