import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { z } from 'zod'
import { logger } from '../lib/logger'
import { configVersionSchema } from '../lib/schemas/firewallSchemas'
import { VercelClient } from '../lib/services/VercelClient'

import { FirewallConfig, IPBlockingRule } from '../lib/types'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { displayIPBlockingTable, displayRulesTable } from '../lib/ui/table'
import { getConfig } from '../lib/utils/config'

interface ListOptions {
  projectId: string
  teamId: string
  token?: string
  format?: 'json' | 'table'
  debug: boolean
  configVersion?: number
}

export const command = 'list [configVersion]'
export const desc = 'List Vercel Firewall rules, optionally for a specific configuration version'

export const builder = {
  configVersion: {
    type: 'number',
    description: 'Specific configuration version to fetch (defaults to latest)',
  },
  projectId: {
    alias: 'p',
    type: 'string',
    description: 'Vercel Project ID (can be set in config file or VERCEL_PROJECT_ID environment variable)',
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID (can be set in config file or VERCEL_TEAM_ID environment variable)',
  },
  token: {
    type: 'string',
    description: 'Vercel API token (defaults to VERCEL_TOKEN env var)',
  },
  format: {
    alias: 'f',
    type: 'string',
    description: 'Output format (json or table)',
    choices: ['json', 'table'],
    default: 'table',
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
}

export const handler = async (argv: Arguments<ListOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    // Try to load config for project/team IDs
    let config = {} as Partial<FirewallConfig>
    try {
      config = await getConfig(undefined, { validate: false, throwOnError: false })
    } catch (error) {
      logger.debug('No config file found or invalid config, proceeding with CLI arguments only')
    }

    const { token, projectId, teamId } = await promptForCredentials({
      token: argv.token,
      projectId: argv.projectId || config?.projectId || undefined,
      teamId: argv.teamId || config?.teamId || undefined,
    })

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

    logger.start(`Fetching firewall configuration${argv.configVersion ? ` version ${argv.configVersion}` : ''} ...`)
    logger.verbose(`Token: ${token}\t projectId: ${projectId}\t teamId: ${teamId}`)

    const liveConfig = await client.fetchFirewallConfig(argv.configVersion)

    const configRules = liveConfig.rules
    const ipBlockingRules = liveConfig.ips as IPBlockingRule[]

    const lastUpdated = new Date(liveConfig.updatedAt)
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(lastUpdated)

    logger.info(
      `Found ${chalk.cyan(configRules.length)} custom rules and ${chalk.cyan(ipBlockingRules.length)} IP blocking rules\n` +
        chalk.dim(`Version: ${chalk.yellow(liveConfig.version)} • Last Updated: ${chalk.yellow(formattedDate)}`),
    )

    if (argv.format === 'json') {
      logger.info(
        JSON.stringify(
          {
            version: liveConfig.version,
            updatedAt: liveConfig.updatedAt,
            lastUpdated: formattedDate,
            rules: configRules,
            ips: ipBlockingRules,
          },
          null,
          2,
        ),
      )
    } else {
      if (configRules.length === 0 && ipBlockingRules.length === 0) {
        logger.info(chalk.yellow('No rules found'))
        return
      }

      if (configRules.length > 0) {
        logger.log(chalk.bold.underline('\nCustom Rules:'), '\n')
        displayRulesTable(configRules, { showStatus: false })
      } else {
        logger.info(chalk.cyan('No custom rules found'))
      }

      if (ipBlockingRules.length > 0) {
        logger.log(chalk.bold.underline('\nIP Blocking Rules:'), '\n')
        displayIPBlockingTable(ipBlockingRules, { showStatus: false })
      } else {
        logger.info(chalk.cyan('No IP blocking rules found'))
      }
    }
  } catch (error) {
    logger.error(error instanceof Error)
    process.exit(1)
  }
}
