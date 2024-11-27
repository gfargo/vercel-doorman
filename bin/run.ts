import chalk from 'chalk'
import { config } from 'dotenv'
import yargs, { CommandModule } from 'yargs'
import { commands } from '../src/commands'

config()

const run = yargs(process.argv.slice(2))
run.usage(`${chalk.bold('▲ Doorman')}\n\n${chalk.dim('Manage Vercel Firewall rules via code')}`)

for (const command of commands) {
  run.command(command as CommandModule)
}

run
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .epilogue(chalk.dim(`See ${chalk.bold('https://doorman.griffen.codes/getting-started')} for more info`)).argv
