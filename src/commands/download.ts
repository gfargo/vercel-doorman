import chalk from 'chalk'
import { LogLevels } from 'consola'
import { readFileSync, writeFileSync } from 'fs'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { VercelClient } from '../lib/services/VercelClient'
import { RuleTransformer } from '../lib/transformers/RuleTransformer'
import { FirewallConfig } from '../lib/types/configTypes'
import { prompt } from '../lib/ui/prompt'
import { displayRulesTable } from '../lib/ui/table'
import { ConfigFinder } from '../lib/utils/configFinder'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

interface DownloadOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  dryRun?: boolean
  debug?: boolean
}

export const command = 'download'
export const desc = 'Download remote Vercel Firewall rules and update local config'

export const builder = {
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path to firewall config file (defaults to vercel-firewall.config.json)',
  },
  projectId: {
    alias: 'p',
    type: 'string',
    description: 'Vercel Project ID (can be set in config file)',
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID (can be set in config file)',
  },
  token: {
    type: 'string',
    description: 'Vercel API token (defaults to VERCEL_TOKEN env var)',
  },
  dryRun: {
    alias: 'd',
    type: 'boolean',
    description: 'Show rules that would be downloaded without making changes',
    default: false,
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
}

export const handler = async (argv: Arguments<DownloadOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    logger.debug('Starting download command')
    logger.debug(`Command arguments: ${JSON.stringify(argv)}`)

    const token = argv.token || process.env.VERCEL_TOKEN
    if (!token) {
      throw new Error('No Vercel token provided. Use --token or set VERCEL_TOKEN environment variable')
    }

    // Find and read config file
    let configPath = argv.config
    if (!configPath) {
      configPath = await ConfigFinder.findConfig()
      if (!configPath) {
        throw new Error(
          `No config file found. Create ${ConfigFinder.getDefaultConfigPath()} or specify path with --config`,
        )
      }
    }
    logger.debug(`Config file path: ${configPath}`)

    // Read and parse existing config file to get project settings
    const configContent = readFileSync(configPath, 'utf8')
    const existingConfig: FirewallConfig = JSON.parse(configContent)
    logger.debug(`Existing config: ${JSON.stringify(existingConfig)}`)

    const projectId = argv.projectId || existingConfig.projectId
    const teamId = argv.teamId || existingConfig.teamId

    if (!projectId) {
      throw new Error('No Project ID provided. Use --projectId or set in config file')
    }

    if (!teamId) {
      throw new Error('No Team ID provided. Use --teamId or set in config file')
    }

    logger.debug(`Project ID: ${projectId}, Team ID: ${teamId}`)

    const client = new VercelClient(projectId, teamId, token)

    logger.start('Fetching remote firewall rules...')
    const vercelRules = await client.fetchFirewallRules()
    logger.debug(`Fetched Vercel rules: ${JSON.stringify(vercelRules)}`)
    const configRules = vercelRules.map(RuleTransformer.fromVercelRule)
    logger.debug(`Transformed config rules: ${JSON.stringify(configRules)}`)

    logger.log(chalk.bold('\nRemote Firewall Rules to Download:\n'))
    displayRulesTable(configRules, { showStatus: false })

    // If dry run, stop here
    if (argv.dryRun) {
      logger.info(chalk.cyan('Dry run completed. No changes made.'))
      return
    }

    const confirmed = await prompt('Do you want to download these rules?', { type: 'confirm' })
    if (!confirmed) {
      logger.info(chalk.yellow('Download cancelled.'))
      return
    }

    const newConfig: FirewallConfig = {
      ...existingConfig,
      rules: configRules,
    }
    logger.debug(`New config to be written: ${JSON.stringify(newConfig)}`)
    writeFileSync(configPath, JSON.stringify(newConfig, null, 2))
    logger.success(`\nSuccessfully downloaded and updated ${configPath}`)
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error downloading firewall rules:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
