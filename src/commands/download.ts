import chalk from 'chalk'
import { LogLevels } from 'consola'
import { readFileSync, writeFileSync } from 'fs'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { VercelClient } from '../lib/services/VercelClient'
import { RuleTransformer } from '../lib/transformers/RuleTransformer'
import { FirewallConfig, IPBlockingRule } from '../lib/types/configTypes'
import { prompt } from '../lib/ui/prompt'
import { displayIPBlockingTable, displayRulesTable } from '../lib/ui/table'
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

import { promptForCredentials } from '../lib/utils/promptForCredentials'

export const handler = async (argv: Arguments<DownloadOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    logger.debug('Starting download command')
    logger.debug(`Command arguments: ${JSON.stringify(argv)}`)

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

    const { token, projectId, teamId } = await promptForCredentials({
      token: argv.token,
      projectId: argv.projectId || existingConfig.projectId,
      teamId: argv.teamId || existingConfig.teamId,
    })

    logger.debug(`Project ID: ${projectId}, Team ID: ${teamId}`)

    const client = new VercelClient(projectId, teamId, token)

    logger.start('Fetching remote firewall configuration...')
    const activeConfig = await client.fetchActiveFirewallConfig()
    logger.debug(`Fetched Vercel config: ${JSON.stringify(activeConfig)}`)

    const configRules = activeConfig.rules.map(RuleTransformer.fromVercelRule)
    logger.debug(`Transformed custom rules: ${JSON.stringify(configRules)}`)

    const ipBlockingRules = activeConfig.ips as IPBlockingRule[]
    logger.debug(`IP blocking rules: ${JSON.stringify(ipBlockingRules)}`)

    logger.log(chalk.bold('\nRemote Custom Rules to Download:\n'))
    displayRulesTable(configRules, { showStatus: false })

    logger.log(chalk.bold('\nRemote IP Blocking Rules to Download:\n'))
    displayIPBlockingTable(ipBlockingRules, { showStatus: false })

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
      version: activeConfig.version,
      updatedAt: activeConfig.updatedAt,
      rules: configRules,
      ips: ipBlockingRules,
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
