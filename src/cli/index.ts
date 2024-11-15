#!/usr/bin/env node

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

yargs(hideBin(process.argv))
  .commandDir('commands')
  .demandCommand(1, 'You need to specify a command')
  .strict()
  .alias('h', 'help')
  .alias('v', 'version')
  .epilogue('For more information, visit https://github.com/gfargo/vercel-doorman').argv
