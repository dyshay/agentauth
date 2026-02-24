#!/usr/bin/env node
import { Command } from 'commander'
import { generateCommand } from './commands/generate.js'
import { verifyCommand } from './commands/verify.js'
import { benchmarkCommand } from './commands/benchmark.js'

const program = new Command()

program
  .name('agentauth')
  .description('AgentAuth CLI — test, benchmark, and generate challenges')
  .version('0.0.1')

program.addCommand(generateCommand)
program.addCommand(verifyCommand)
program.addCommand(benchmarkCommand)

program.parse()
