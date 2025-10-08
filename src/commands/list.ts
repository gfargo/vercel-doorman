import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { z } from 'zod'
import { logger } from '../lib/logger'
import { configVersionSchema } from '../lib/schemas/firewallSchemas'
import { VercelClient } from '../lib/services/VercelClient'

import { FirewallConfig, IPBlockingRule, isUnifiedConfig } from '../lib/types'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { displayIPBlockingTable, displayRulesTable } from '../lib/ui/table'
import { getConfig } from '../lib/utils/config'
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface ListOptions {
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
  format?: 'json' | 'table'
  debug?: boolean
  configVersion?: number
  ci?: boolean
}

export const command = 'list [configVersion]'
export const desc = 'List firewall rules, optionally for a specific configuration version'

export const builder = {
  configVersion: {
    type: 'number',
    description: 'Specific configuration version to fetch (Vercel only, defaults to latest)',
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
  ci: {
    type: 'boolean',
    description: 'Run in CI mode (non-interactive)',
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
      config = await getConfig(argv.config, { validate: false, throwOnError: false })
    } catch (error) {
      logger.debug('No config file found or invalid config, proceeding with CLI arguments only')
    }

    // Check if this is a legacy Vercel-only usage (backward compatibility)
    const configProvider = config && isUnifiedConfig(config) ? config.provider : undefined
    const isLegacyVercelUsage =
      !argv.provider && !configProvider && (argv.projectId || argv.teamId || argv.token || config?.projectId)

    if (isLegacyVercelUsage) {
      // Use legacy Vercel-specific code path for backward compatibility
      logger.debug('Using legacy Vercel code path')

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

      return
    }

    // New multi-provider code path
    logger.debug('Using multi-provider code path')

    // Get provider instance (auto-detect or explicit)
    const provider = await getProviderInstance({
      provider: argv.provider as ProviderType | undefined,
      config,
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

    // Validate version if provided (Vercel only)
    if (argv.configVersion !== undefined && provider.name === 'vercel') {
      try {
        configVersionSchema.parse(argv.configVersion)
      } catch (error) {
        if (error instanceof z.ZodError) {
          logger.error('Invalid configuration version number. Version must be a positive integer.')
          process.exit(1)
        }
        throw error
      }
    } else if (argv.configVersion !== undefined && provider.name === 'cloudflare') {
      logger.warn(chalk.yellow('Cloudflare does not support configuration versions. Ignoring --configVersion flag.'))
    }

    logger.start(
      `Fetching firewall configuration from ${providerName}${argv.configVersion && provider.name === 'vercel' ? ` version ${argv.configVersion}` : ''} ...`,
    )

    const unifiedConfig = await provider.fetchConfig(argv.configVersion)
    const { RuleTranslator } = await import('../lib/translators/RuleTranslator')

    // Convert to Vercel format for display
    const configRules = unifiedConfig.rules.map((rule) => RuleTranslator.unifiedToVercel(rule).result)
    const ipBlockingRules = (unifiedConfig.ips || []).map((ip) => ({
      ...ip,
      hostname: ip.hostname || '',
    }))

    const lastUpdatedStr = unifiedConfig.metadata?.updatedAt
    const lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : new Date()
    const formattedDate = new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'medium',
    }).format(lastUpdated)

    const versionInfo =
      provider.name === 'vercel' && unifiedConfig.metadata?.version
        ? `Version: ${chalk.yellow(unifiedConfig.metadata.version)} • `
        : ''

    logger.info(
      `Found ${chalk.cyan(configRules.length)} custom rules and ${chalk.cyan(ipBlockingRules.length)} IP blocking rules\n` +
        chalk.dim(`${versionInfo}Provider: ${chalk.cyan(providerName)} • Last Updated: ${chalk.yellow(formattedDate)}`),
    )

    if (argv.format === 'json') {
      logger.info(
        JSON.stringify(
          {
            provider: provider.name,
            version: unifiedConfig.metadata?.version,
            updatedAt: unifiedConfig.metadata?.updatedAt,
            lastUpdated: formattedDate,
            rules: unifiedConfig.rules,
            ips: unifiedConfig.ips || [],
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
        logger.log(chalk.bold.underline(`\nCustom Rules (${providerName}):`), '\n')
        displayRulesTable(configRules, { showStatus: false })
      } else {
        logger.info(chalk.cyan('No custom rules found'))
      }

      if (ipBlockingRules.length > 0) {
        logger.log(chalk.bold.underline(`\nIP Blocking Rules (${providerName}):`), '\n')
        displayIPBlockingTable(ipBlockingRules, { showStatus: false })
      } else {
        logger.info(chalk.cyan('No IP blocking rules found'))
      }
    }
  } catch (error) {
    logger.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
