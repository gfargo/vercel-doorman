import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { z } from 'zod'
import { logger } from '../lib/logger'
import { configVersionSchema } from '../lib/schemas/firewallSchemas'
import { VercelClient } from '../lib/services/VercelClient'
import { FirewallConfig, IPBlockingRule, UnifiedConfig } from '../lib/types'
import { prompt } from '../lib/ui/prompt'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { displayIPBlockingTable, displayRulesTable } from '../lib/ui/table'
import { getConfig, saveConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface DownloadOptions {
  config?: string
  provider?: 'vercel' | 'cloudflare'
  // Vercel options
  projectId?: string
  teamId?: string
  token?: string
  // Cloudflare options
  apiToken?: string
  zoneId?: string
  accountId?: string
  // Common options
  dryRun?: boolean
  debug?: boolean
  configVersion?: number
  ci?: boolean
}

export const command = 'download [configVersion]'
export const desc =
  'Download remote firewall rules and update local config, optionally for a specific configuration version'

export const builder = {
  configVersion: {
    type: 'number',
    description: 'Specific configuration version to download (defaults to latest)',
  },
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path to firewall config file',
  },
  provider: {
    type: 'string',
    description: 'Firewall provider (vercel or cloudflare) - auto-detected if not specified',
    choices: ['vercel', 'cloudflare'],
  },
  // Vercel options
  projectId: {
    alias: 'p',
    type: 'string',
    description: 'Vercel Project ID',
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID',
  },
  token: {
    type: 'string',
    description: 'Vercel API token (defaults to VERCEL_TOKEN env var)',
  },
  // Cloudflare options
  apiToken: {
    type: 'string',
    description: 'Cloudflare API token (defaults to CLOUDFLARE_API_TOKEN env var)',
  },
  zoneId: {
    type: 'string',
    description: 'Cloudflare Zone ID (defaults to CLOUDFLARE_ZONE_ID env var)',
  },
  accountId: {
    type: 'string',
    description: 'Cloudflare Account ID (optional, defaults to CLOUDFLARE_ACCOUNT_ID env var)',
  },
  // Common options
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
  ci: {
    type: 'boolean',
    description: 'Run in CI mode (non-interactive)',
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
    let existingConfig: Partial<FirewallConfig> | Partial<UnifiedConfig> = {}
    try {
      existingConfig = await getConfig(argv.config, { validate: false, throwOnError: false })
      logger.debug(`Existing config: ${JSON.stringify(existingConfig)}`)
    } catch (error) {
      if (error instanceof Error && error.message.includes('No config file found')) {
        const shouldCreate =
          argv.ci ||
          (await prompt('No config file found. Would you like to create a new one?', {
            type: 'confirm',
          }))
        if (!shouldCreate) {
          logger.info(chalk.yellow('Download cancelled. No config file created.'))
          return
        }
        logger.info(`Will create new config file`)
      } else {
        logger.error(error)
        logger.info('Proceeding with empty configuration')
      }
    }

    // Check if this is a legacy Vercel-only usage (backward compatibility)
    const existingProvider = 'provider' in existingConfig ? existingConfig.provider : undefined
    const existingProjectId = 'projectId' in existingConfig ? existingConfig.projectId : undefined
    const isLegacyVercelUsage = !argv.provider && !existingProvider

    if (isLegacyVercelUsage) {
      // Use legacy Vercel-specific code path for backward compatibility
      logger.debug('Using legacy Vercel code path')

      const existingTeamId = 'teamId' in existingConfig ? existingConfig.teamId : undefined

      const { token, projectId, teamId } = await promptForCredentials({
        token: argv.token,
        projectId: argv.projectId || existingProjectId,
        teamId: argv.teamId || existingTeamId,
      })

      logger.debug(`Project ID: ${projectId}, Team ID: ${teamId}`)

      // Validate version if provided
      if (argv.configVersion !== undefined) {
        try {
          configVersionSchema.parse(argv.configVersion)
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.error('Invalid configuration version number. Version must be a positive integer.')
            if (!argv.ci) {
              process.exit(1)
            }
            return
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

      const confirmed =
        argv.ci ||
        (await prompt(
          `Do you want to download${argv.configVersion ? ` version ${argv.configVersion}` : ' the latest version'} of these rules? This will overwrite your local configuration.`,
          { type: 'confirm' },
        ))
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
      return
    }

    // New multi-provider code path
    logger.debug('Using multi-provider code path')

    // Get provider instance (auto-detect or explicit)
    const provider = await getProviderInstance({
      provider: argv.provider as ProviderType | undefined,
      config: existingConfig,
      interactive: !argv.ci,
      // Vercel credentials
      token: argv.token,
      projectId: argv.projectId,
      teamId: argv.teamId,
      // Cloudflare credentials
      apiToken: argv.apiToken,
      zoneId: argv.zoneId,
      accountId: argv.accountId,
    })

    const providerName = getProviderDisplayName(provider.name)
    logger.debug(`Using provider: ${providerName}`)

    // Validate version if provided (Cloudflare doesn't use versions)
    if (argv.configVersion !== undefined && provider.name === 'vercel') {
      try {
        configVersionSchema.parse(argv.configVersion)
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('Invalid configuration version number. Version must be a positive integer.')
          if (!argv.ci) {
            process.exit(1)
          }
          return
        }
        throw error
      }
    } else if (argv.configVersion !== undefined && provider.name === 'cloudflare') {
      logger.warn(chalk.yellow('Cloudflare does not support configuration versions. Ignoring --configVersion flag.'))
    }

    logger.start(
      `Fetching remote firewall configuration from ${providerName}${argv.configVersion && provider.name === 'vercel' ? ` version ${argv.configVersion}` : ''} ...`,
    )
    const unifiedConfig = await provider.fetchConfig(argv.configVersion)
    logger.debug(`Fetched unified config: ${JSON.stringify(unifiedConfig)}`)

    const { RuleTranslator } = await import('../lib/translators/RuleTranslator')

    // Convert to Vercel format for display
    const configRulesForDisplay = unifiedConfig.rules.map((rule) => RuleTranslator.unifiedToVercel(rule).result)
    const ipBlockingRulesForDisplay = (unifiedConfig.ips || []).map((ip) => ({
      ...ip,
      hostname: ip.hostname || '',
    }))

    if (configRulesForDisplay.length > 0) {
      logger.log(chalk.bold(`\\nRemote Custom Rules from ${providerName}:\\n`))
      displayRulesTable(configRulesForDisplay, { showStatus: false })
    } else {
      logger.info('No custom rules to download...')
    }

    if (ipBlockingRulesForDisplay.length > 0) {
      logger.log(chalk.bold(`\\nRemote IP Blocking Rules from ${providerName}:\\n`))
      displayIPBlockingTable(ipBlockingRulesForDisplay, { showStatus: false })
    } else {
      logger.info('No IP blocking rules to download...')
    }

    // If dry run, stop here
    if (argv.dryRun) {
      logger.info(chalk.cyan('Dry run completed. No changes made.'))
      return
    }

    const confirmed =
      argv.ci ||
      (await prompt(
        `Do you want to download these rules from ${providerName}? This will overwrite your local configuration.`,
        { type: 'confirm' },
      ))
    if (!confirmed) {
      logger.info(chalk.yellow('Download cancelled.'))
      return
    }

    // Save unified config format
    const newConfig: FirewallConfig | UnifiedConfig = {
      ...existingConfig,
      ...unifiedConfig,
      $schema:
        existingConfig.$schema ||
        'https://raw.githubusercontent.com/gfargo/vercel-doorman/main/src/lib/schemas/firewall.schema.json',
      version: '2.0',
      provider: provider.name,
    }

    logger.debug(`New config to be written: ${JSON.stringify(newConfig)}`)
    logger.start(`Saving configuration from ${providerName}`)

    await saveConfig(newConfig as unknown as FirewallConfig, argv.config)
    logger.success(chalk.green(`Successfully downloaded and updated configuration from ${providerName}`))
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
    if (!argv.ci) {
      process.exit(1)
    }
  }
}
