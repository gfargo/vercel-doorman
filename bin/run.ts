import chalk from 'chalk'
import { config } from 'dotenv'
import yargs, { CommandModule } from 'yargs'
import { commands } from '../src/commands'

config()

const run = yargs(process.argv.slice(2))
run.usage(
  `Welcome ${chalk.bold(chalk.red('vercel-doorman'))}!
    See more on https://github.com/gfargo/vercel-doorman`,
)
for (const command of commands) {
  run.command(command as CommandModule)
}

run.demandCommand(1, 'You need at least one command before moving on').help().argv
