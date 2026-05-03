import type { Arguments, CommandBuilder } from 'yargs'
import chalk from 'chalk'
import { logger } from '../lib/logger'
import { getConfig } from '../lib/utils/config'
import { isUnifiedConfig } from '../lib/types'

interface HealthOptions {
  config?: string
  provider?: 'vercel' | 'cloudflare'
  quick?: boolean
  credentials?: boolean
  connectivity?: boolean
  apiToken?: string
  zoneId?: string
  accountId?: string
}

export const command = 'health'
export const describe = 'Check the health of your firewall configuration and setup'

export const builder: CommandBuilder<HealthOptions, HealthOptions> = (yargs) =>
  yargs
    .option('config', {
      type: 'string',
      description: 'Path to config file',
      alias: 'c',
    })
    .option('provider', {
      type: 'string',
      choices: ['vercel', 'cloudflare'] as const,
      description: 'Provider to check (auto-detected if not specified)',
    })
    .option('quick', {
      type: 'boolean',
      description: 'Run quick validation without credential or connectivity checks',
      default: false,
    })
    .option('credentials', {
      type: 'boolean',
      description: 'Validate credentials with API calls',
      default: true,
    })
    .option('connectivity', {
      type: 'boolean',
      description: 'Test connectivity to provider APIs',
      default: true,
    })
    // Cloudflare options
    .option('apiToken', {
      type: 'string',
      description: 'Cloudflare API token (defaults to CLOUDFLARE_API_TOKEN env var)',
      group: 'Cloudflare Options:',
    })
    .option('zoneId', {
      type: 'string',
      description: 'Cloudflare Zone ID (defaults to CLOUDFLARE_ZONE_ID env var)',
      group: 'Cloudflare Options:',
    })
    .option('accountId', {
      type: 'string',
      description: 'Cloudflare Account ID (optional, defaults to CLOUDFLARE_ACCOUNT_ID env var)',
      group: 'Cloudflare Options:',
    })
    .example('$0 health', 'Run comprehensive health check')
    .example('$0 health --quick', 'Run quick configuration validation only')
    .example('$0 health --provider cloudflare', 'Check Cloudflare setup specifically')
    .example('$0 health --no-credentials', 'Skip credential validation')

export const handler = async (argv: Arguments<HealthOptions>): Promise<void> => {
  try {
    logger.info(chalk.bold('🏥 Doorman Health Check'))
    logger.info('')

    // Load configuration
    const config = await getConfig(argv.config, { validate: false, throwOnError: false })

    // Determine provider
    let provider = argv.provider
    if (!provider) {
      if (isUnifiedConfig(config)) {
        provider = config.provider || 'vercel'
      } else {
        provider = 'vercel' // Legacy config format
      }
    }

    logger.info(`Provider: ${chalk.cyan(provider)}`)
    logger.info('')

    if (provider === 'cloudflare') {
      await runCloudflareHealthCheck(config, argv)
    } else if (provider === 'vercel') {
      await runVercelHealthCheck(config, argv)
    } else {
      logger.error(`Unsupported provider: ${provider}`)
      process.exit(1)
    }
  } catch (error) {
    logger.error('Health check failed:', error)
    process.exit(1)
  }
}

/**
 * Run Cloudflare health check
 */
async function runCloudflareHealthCheck(config: any, argv: HealthOptions): Promise<void> {
  // Override environment variables if provided via CLI
  if (argv.apiToken) process.env.CLOUDFLARE_API_TOKEN = argv.apiToken
  if (argv.zoneId) process.env.CLOUDFLARE_ZONE_ID = argv.zoneId
  if (argv.accountId) process.env.CLOUDFLARE_ACCOUNT_ID = argv.accountId

  // Ensure config has provider set
  if (!isUnifiedConfig(config)) {
    logger.error('Cloudflare health check requires unified configuration format')
    logger.info('Run `doorman init --provider cloudflare` to create a proper configuration')
    process.exit(1)
  }

  // Set provider if not already set
  if (!config.provider) {
    config.provider = 'cloudflare'
  }

  try {
    if (argv.quick) {
      logger.info('Running quick configuration validation...')
      
      const { CloudflareValidationService } = await import('../lib/providers/cloudflare/CloudflareValidationService')
      const validationService = CloudflareValidationService.forQuickCheck()
      const result = await validationService.quickValidate(config)
      
      logger.info('')
      logger.info(CloudflareValidationService.formatComprehensiveResults({
        configValidation: result,
        overall: result.valid ? (result.warnings.length > 0 ? 'degraded' : 'healthy') : 'unhealthy',
        summary: result.valid ? 'Quick validation passed' : 'Quick validation failed',
        recommendations: result.suggestions,
      }))
    } else {
      logger.info('Running comprehensive health check...')
      
      const { CloudflareValidationService } = await import('../lib/providers/cloudflare/CloudflareValidationService')
      const validationService = new CloudflareValidationService({
        validateCredentials: argv.credentials,
        checkEnvironmentVariables: true,
        validateConnectivity: argv.connectivity,
        skipSetupVerification: false,
      })

      const result = await validationService.validateConfiguration(config)
      
      logger.info('')
      logger.info(CloudflareValidationService.formatComprehensiveResults(result))
    }

    // Exit with appropriate code
    const exitCode = await getExitCode(config, argv)
    if (exitCode !== 0) {
      process.exit(exitCode)
    }

    logger.info('')
    logger.info(chalk.green('✅ Health check completed successfully!'))
  } catch (error) {
    logger.error('Cloudflare health check failed:', error)
    
    if (error instanceof Error) {
      if (error.message.includes('CLOUDFLARE_API_TOKEN')) {
        logger.info('')
        logger.info(chalk.yellow('💡 Set your Cloudflare API token:'))
        logger.info(chalk.cyan('export CLOUDFLARE_API_TOKEN="your-token-here"'))
      }
      
      if (error.message.includes('Zone ID')) {
        logger.info('')
        logger.info(chalk.yellow('💡 Set your Cloudflare Zone ID:'))
        logger.info(chalk.cyan('export CLOUDFLARE_ZONE_ID="your-zone-id-here"'))
      }
    }
    
    process.exit(1)
  }
}

/**
 * Run Vercel health check (placeholder for future implementation)
 */
async function runVercelHealthCheck(config: any, argv: HealthOptions): Promise<void> {
  logger.info('Vercel health check is not yet implemented')
  logger.info('Basic configuration validation:')
  
  try {
    // Basic validation for Vercel configs
    if (!config.rules) {
      logger.warn('⚠️  No rules found in configuration')
    } else {
      logger.info(`✅ Found ${config.rules.length} rule(s) in configuration`)
    }

    if (!process.env.VERCEL_TOKEN) {
      logger.warn('⚠️  VERCEL_TOKEN environment variable not found')
      logger.info('💡 Set your Vercel token: export VERCEL_TOKEN="your-token-here"')
    } else {
      logger.info('✅ VERCEL_TOKEN environment variable found')
    }

    logger.info('')
    logger.info(chalk.green('✅ Basic Vercel validation completed'))
  } catch (error) {
    logger.error('Vercel health check failed:', error)
    process.exit(1)
  }
}

/**
 * Determine appropriate exit code based on health check results
 */
async function getExitCode(config: any, argv: HealthOptions): Promise<number> {
  if (argv.quick) {
    // For quick checks, only fail on configuration errors
    const { CloudflareValidationService } = await import('../lib/providers/cloudflare/CloudflareValidationService')
    const validationService = CloudflareValidationService.forQuickCheck()
    const result = await validationService.quickValidate(config)
    return result.valid ? 0 : 1
  }

  // For full checks, consider both config and setup
  const { CloudflareValidationService } = await import('../lib/providers/cloudflare/CloudflareValidationService')
  const validationService = new CloudflareValidationService({
    validateCredentials: argv.credentials,
    checkEnvironmentVariables: true,
    validateConnectivity: argv.connectivity,
    skipSetupVerification: false,
  })

  try {
    const result = await validationService.validateConfiguration(config)
    
    switch (result.overall) {
      case 'healthy':
        return 0
      case 'degraded':
        return 0 // Warnings don't cause failure
      case 'unhealthy':
        return 1
      default:
        return 1
    }
  } catch (error) {
    return 1
  }
}