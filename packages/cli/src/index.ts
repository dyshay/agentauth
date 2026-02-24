#!/usr/bin/env node
import { Command } from 'commander'
import { generateCommand } from './commands/generate.js'
import { verifyCommand } from './commands/verify.js'
import { benchmarkCommand } from './commands/benchmark.js'
import { addCommand } from './commands/add.js'
import { listCommand } from './commands/list.js'
import { searchCommand } from './commands/search.js'
import { publishCommand } from './commands/publish.js'

const program = new Command()

program
  .name('agentauth')
  .description('AgentAuth CLI — test, benchmark, and manage challenge packages')
  .version('0.0.1')

program.addCommand(generateCommand)
program.addCommand(verifyCommand)
program.addCommand(benchmarkCommand)
program.addCommand(addCommand)
program.addCommand(listCommand)
program.addCommand(searchCommand)
program.addCommand(publishCommand)

program.parse()
