import { readFileSync } from 'fs'
import { Arguments } from 'yargs'
import { VercelClient } from '../lib/fetchUtility'
import { logger } from '../lib/logger'
import { FirewallService } from '../lib/services/FirewallService'
import { ValidationService } from '../lib/services/ValidationService'
import { FirewallConfig } from '../lib/types/configTypes'
import { ConfigFinder } from '../lib/utils/configFinder'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

interface SyncOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
}

export const command = 'sync'
export const desc = 'Sync Vercel Firewall rules with config file'

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
}

export const handler = async (argv: Arguments<SyncOptions>) => {
  try {
    // Get token from args or environment
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

    // Read and parse config file
    const configContent = readFileSync(configPath, 'utf8')
    const configJson = JSON.parse(configContent)

    // Validate config
    const validator: ValidationService = ValidationService.getInstance()
    validator.validateConfig(configJson)

    // Config is now type-safe
    const config: FirewallConfig = configJson

    // Get project settings from args or config
    const projectId = argv.projectId || config.projectId
    const teamId = argv.teamId || config.teamId

    if (!projectId) {
      throw new Error('No Project ID provided. Use --projectId or set in config file')
    }

    if (!teamId) {
      throw new Error('No Team ID provided. Use --teamId or set in config file')
    }

    // Initialize client and service
    const client = new VercelClient(projectId, teamId, token)
    const service = new FirewallService(client)

    // Perform sync
    logger.start('Starting firewall rules sync...')
    await service.syncRules(config)
    logger.success('Firewall rules sync completed successfully')
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else if (error instanceof Error && error.name === 'ValidationError') {
      logger.error(error)
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error syncing firewall rules:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
