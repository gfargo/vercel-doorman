import { Arguments } from 'yargs'
import { VercelClient } from '../../lib/fetchUtility'
import { RuleTransformer } from '../../lib/transformers/RuleTransformer'

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
    description: 'Vercel Project ID',
    demandOption: true,
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID',
    demandOption: true,
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

    // Initialize client
    const client = new VercelClient(argv.projectId, argv.teamId, token)

    // Fetch rules
    console.log('Fetching firewall rules...')
    const rules = await client.fetchFirewallRules()

    // Convert to config format for cleaner output
    const configRules = rules.map(RuleTransformer.fromVercelRule)

    if (argv.format === 'json') {
      console.log(JSON.stringify(configRules, null, 2))
    } else {
      console.log('\nCurrent Firewall Rules:')
      console.log('======================\n')

      configRules.forEach((rule, index) => {
        console.log(`${index + 1}. ${rule.name}`)
        console.log(`   Type: ${rule.type}`)
        console.log(`   Action: ${rule.action}`)
        console.log(`   Values: ${rule.values.join(', ')}`)
        console.log(`   Active: ${rule.active}`)
        if (rule.description) {
          console.log(`   Description: ${rule.description}`)
        }
        console.log('')
      })
    }
  } catch (error) {
    console.error('Error listing firewall rules:', error instanceof Error ? error.message : error)
    process.exit(1)
  }
}
