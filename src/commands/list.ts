import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { IPBlockingRule } from '../lib/schemas/firewallSchemas'
import { VercelClient } from '../lib/services/VercelClient'
import { RuleTransformer } from '../lib/transformers/RuleTransformer'
import { displayIPBlockingTable, displayRulesTable } from '../lib/ui/table'
import { promptForCredentials } from '../lib/utils/promptForCredentials'

interface ListOptions {
  projectId: string
  teamId: string
  token?: string
  format?: 'json' | 'table'
  debug: boolean
}

export const command = 'list'
export const desc = 'List current Vercel Firewall rules'

export const builder = {
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

    const { token, projectId, teamId } = await promptForCredentials({
      token: argv.token,
      projectId: argv.projectId,
      teamId: argv.teamId,
    })

    const client = new VercelClient(projectId, teamId, token)

    logger.start(`Fetching firewall configuration ...`)
    logger.verbose(`Token: ${token}\t projectId: ${projectId}\t teamId: ${teamId}`)

    const activeConfig = await client.fetchActiveFirewallConfig()

    // Convert custom rules to config format for cleaner output
    const configRules = activeConfig.rules.map(RuleTransformer.fromVercelRule)
    const ipBlockingRules = activeConfig.ips as IPBlockingRule[]

    const lastUpdated = new Date(activeConfig.updatedAt)
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(lastUpdated)

    logger.info(
      `Found ${chalk.cyan(configRules.length)} custom rules and ${chalk.cyan(ipBlockingRules.length)} IP blocking rules\n` +
        chalk.dim(`Version: ${chalk.yellow(activeConfig.version)} • Last Updated: ${chalk.yellow(formattedDate)}`),
    )

    if (argv.format === 'json') {
      logger.info(
        JSON.stringify(
          {
            version: activeConfig.version,
            updatedAt: activeConfig.updatedAt,
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
        logger.info(chalk.yellow('\nNo custom rules found'))
      }

      if (ipBlockingRules.length > 0) {
        logger.log(chalk.bold.underline('\nIP Blocking Rules:'), '\n')
        displayIPBlockingTable(ipBlockingRules, { showStatus: false })
      } else {
        logger.info(chalk.yellow('\nNo IP blocking rules found'))
      }
    }
  } catch (error) {
    logger.error(error instanceof Error)
    process.exit(1)
  }
}
