import chalk from 'chalk'
import { Arguments } from 'yargs'
import { VercelClient } from '../lib/fetchUtility'
import { RuleTransformer } from '../lib/transformers/RuleTransformer'
import { logger } from '../logger'

interface ListOptions {
  projectId: string
  teamId: string
  token?: string
  format?: 'json' | 'table'
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
}

export const handler = async (argv: Arguments<ListOptions>) => {
  try {
    // Get token from args or environment
    const token = argv.token || process.env.VERCEL_TOKEN
    if (!token) {
      throw new Error('No Vercel token provided. Use --token or set VERCEL_TOKEN environment variable')
    }

    const projectId = argv.projectId || process.env.VERCEL_PROJECT_ID
    if (!projectId) {
      throw new Error('No Vercel project ID provided. Use --projectId or set VERCEL_PROJECT_ID environment variable')
    }

    const teamId = argv.teamId || process.env.VERCEL_TEAM_ID
    if (!teamId) {
      throw new Error('No Vercel team ID provided. Use --teamId or set VERCEL_TEAM_ID environment variable')
    }

    // Initialize client
    const client = new VercelClient(projectId, teamId, token)

    // Fetch rules
    logger.start('Fetching firewall rules...')
    const rules = await client.fetchFirewallRules()

    logger.info(`Found ${rules.length} firewall rules`)

    // Convert to config format for cleaner output
    const configRules = rules.map(RuleTransformer.fromVercelRule)

    if (argv.format === 'json') {
      logger.info(JSON.stringify(configRules, null, 2))
    } else {
      logger.log(chalk.bold('\nCurrent Firewall Rules:\n'))
      configRules.forEach((rule, index) => {
        logger.log(`${chalk.bold(`${index + 1}.`)} ${rule.name}`)
        logger.log(`   Type: ${rule.type}`)
        logger.log(`   Action: ${rule.action}`)
        logger.log(`   Values: ${rule.values.join(', ')}`)
        logger.log(`   Active: ${rule.active}`)
        if (rule.description) {
          logger.log(`   Description: ${rule.description}`)
        }
        logger.log('')
      })
    }
  } catch (error) {
    logger.error(error instanceof Error)
    process.exit(1)
  }
}
