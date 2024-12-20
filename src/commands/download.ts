import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { z } from 'zod'
import { logger } from '../lib/logger'
import { configVersionSchema } from '../lib/schemas/firewallSchemas'
import { VercelClient } from '../lib/services/VercelClient'
import { FirewallConfig, IPBlockingRule } from '../lib/types'
import { prompt } from '../lib/ui/prompt'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { displayIPBlockingTable, displayRulesTable } from '../lib/ui/table'
import { getConfig, saveConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
interface DownloadOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  dryRun?: boolean
  debug?: boolean
  configVersion?: number
}

export const command = 'download [configVersion]'
export const desc =
  'Download remote Vercel Firewall rules and update local config, optionally for a specific configuration version'

export const builder = {
  configVersion: {
    type: 'number',
    description: 'Specific configuration version to download (defaults to latest)',
  },
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

    // Try to load existing config, but don't fail if it doesn't exist or is invalid
    let existingConfig: Partial<FirewallConfig> = {}
    try {
      existingConfig = await getConfig(argv.config, { validate: false, throwOnError: false })
      logger.debug(`Existing config: ${JSON.stringify(existingConfig)}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('No config file found')) {
        const createNewConfig = await prompt('No config file found. Would you like to create a new one?', {
          type: 'confirm',
        })
        if (!createNewConfig) {
          logger.info(chalk.yellow('Download cancelled. No config file created.'))
          return
        }
        logger.info(`Will create new config file`)
      } else {
        logger.error(error)
        logger.info('Proceeding with empty configuration')
      }
    }

    const { token, projectId, teamId } = await promptForCredentials({
      token: argv.token,
      projectId: argv.projectId || existingConfig.projectId,
      teamId: argv.teamId || existingConfig.teamId,
    })

    logger.debug(`Project ID: ${projectId}, Team ID: ${teamId}`)

    // Validate version if provided
    if (argv.configVersion !== undefined) {
      try {
        configVersionSchema.parse(argv.configVersion)
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('Invalid configuration version number. Version must be a positive integer.')
          process.exit(1)
        }
        throw error
      }
    }

    const client = new VercelClient(projectId, teamId, token)

    logger.start(
      `Fetching remote firewall configuration${argv.configVersion ? ` version ${argv.configVersion}` : ''} ...`,
    )
    const config = await client.fetchFirewallConfig(argv.configVersion)
    logger.debug(`Fetched Vercel config: ${JSON.stringify(config)}`)

    const configRules = config.rules
    logger.debug(`Custom rules: ${JSON.stringify(configRules)}`)

    const ipBlockingRules = config.ips as IPBlockingRule[]
    logger.debug(`IP blocking rules: ${JSON.stringify(ipBlockingRules)}`)

    if (configRules.length > 0) {
      logger.log(chalk.bold('\nRemote Custom Rules to Download:\n'))
      displayRulesTable(configRules, { showStatus: false })
    } else {
      logger.info('No custom rules to download...')
    }

    if (ipBlockingRules.length > 0) {
      logger.log(chalk.bold('\nRemote IP Blocking Rules to Download:\n'))
      displayIPBlockingTable(ipBlockingRules, { showStatus: false })
    } else {
      logger.info('No IP blocking rules to download...')
    }

    // If dry run, stop here
    if (argv.dryRun) {
      logger.info(chalk.cyan('Dry run completed. No changes made.'))
      return
    }

    const confirmed = await prompt(
      `Do you want to download${argv.configVersion ? ` version ${argv.configVersion}` : ' the latest version'} of these rules? This will overwrite your local configuration.`,
      { type: 'confirm' },
    )
    if (!confirmed) {
      logger.info(chalk.yellow('Download cancelled.'))
      return
    }

    const newConfig: FirewallConfig = {
      ...existingConfig,
      projectId,
      teamId,
      version: config.version,
      updatedAt: config.updatedAt,
      rules: configRules,
      ips: ipBlockingRules,
    }
    logger.debug(`New config to be written: ${JSON.stringify(newConfig)}`)
    logger.start(`Saving configuration with version: ${newConfig.version}`)

    await saveConfig(newConfig, argv.config)
    logger.success(chalk.green('Successfully downloaded and updated configuration'))
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
