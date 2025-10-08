import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { displayIPBlockingTable, displayRulesTable, RULE_STATUS_MAP } from '../lib/ui/table'
import { getConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface DiffOptions {
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
  debug?: boolean
  format?: 'table' | 'json'
  ci?: boolean
}

export const command = 'diff'
export const desc = 'Show detailed differences between local and remote firewall configuration'

export const builder = {
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
    choices: ['table', 'json'],
    description: 'Output format',
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

export const handler = async (argv: Arguments<DiffOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    // Load and validate config
    const config = await getConfig(argv.config)

    // Check if this is a legacy Vercel-only usage (backward compatibility)
    const configProvider = 'provider' in config ? config.provider : undefined
    const configProjectId = 'projectId' in config ? config.projectId : undefined
    const configTeamId = 'teamId' in config ? config.teamId : undefined
    const isLegacyVercelUsage =
      !argv.provider && !configProvider && (argv.projectId || argv.teamId || argv.token || configProjectId)

    if (isLegacyVercelUsage) {
      // Use legacy Vercel-specific code path for backward compatibility
      logger.debug('Using legacy Vercel code path')

      const { token, projectId, teamId } = await promptForCredentials({
        token: argv.token,
        projectId: argv.projectId || configProjectId,
        teamId: argv.teamId || configTeamId,
      })

      const client = new VercelClient(projectId, teamId, token)
      const service = new FirewallService(client)

      logger.start('Calculating differences...')

      const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } =
        await service.getChanges(config)

      const hasCustomRuleChanges = toAdd.length > 0 || toUpdate.length > 0 || toDelete.length > 0
      const hasIPRuleChanges = ipsToAdd.length > 0 || ipsToUpdate.length > 0 || ipsToDelete.length > 0
      const hasVersionChange = config.version !== version

      if (!hasCustomRuleChanges && !hasIPRuleChanges && !hasVersionChange) {
        logger.success(chalk.green('No differences found. Local and remote configurations are in sync.'))
        return
      }

      if (argv.format === 'json') {
        // JSON output for programmatic use
        const diff = {
          version: {
            local: config.version,
            remote: version,
            changed: hasVersionChange,
          },
          customRules: {
            toAdd: toAdd.map((rule) => ({ ...rule, status: 'add' })),
            toUpdate: toUpdate.map((rule) => ({ ...rule, status: 'update' })),
            toDelete: toDelete.map((rule) => ({ ...rule, status: 'delete' })),
          },
          ipRules: {
            toAdd: ipsToAdd.map((rule) => ({ ...rule, status: 'add' })),
            toUpdate: ipsToUpdate.map((rule) => ({ ...rule, status: 'update' })),
            toDelete: ipsToDelete.map((rule) => ({ ...rule, status: 'delete' })),
          },
          summary: {
            hasChanges: hasCustomRuleChanges || hasIPRuleChanges || hasVersionChange,
            customRuleChanges: toAdd.length + toUpdate.length + toDelete.length,
            ipRuleChanges: ipsToAdd.length + ipsToUpdate.length + ipsToDelete.length,
          },
        }

        logger.log(JSON.stringify(diff, null, 2))
        return
      }

      // Table format (default)
      logger.log(chalk.bold('\n🔍 Configuration Differences\n'))

      if (hasVersionChange) {
        logger.log(chalk.bold('Version Changes:'))
        logger.log(`  Local:  ${chalk.red(config.version || 'unknown')}`)
        logger.log(`  Remote: ${chalk.green(version)}`)
        logger.log('')
      }

      if (hasCustomRuleChanges) {
        logger.log(chalk.bold('Custom Rule Changes:\n'))
        displayRulesTable(
          [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...toAdd.map((rule: any) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id as string })),
            ...toUpdate.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.modified, id: rule.id as string })),
            ...toDelete.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.deleted, id: rule.id as string })),
          ],
          { showStatus: true },
        )
        logger.log('')
      }

      if (hasIPRuleChanges) {
        logger.log(chalk.bold('IP Blocking Rule Changes:\n'))
        displayIPBlockingTable(
          [
            ...ipsToAdd.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id || undefined })),
            ...ipsToUpdate.map((rule) => ({
              ...rule,
              changeStatus: RULE_STATUS_MAP.modified,
              id: rule.id || undefined,
            })),
            ...ipsToDelete.map((rule) => ({
              ...rule,
              changeStatus: RULE_STATUS_MAP.deleted,
              id: rule.id || undefined,
            })),
          ],
          { showStatus: true },
        )
        logger.log('')
      }

      // Summary
      const totalChanges =
        toAdd.length + toUpdate.length + toDelete.length + ipsToAdd.length + ipsToUpdate.length + ipsToDelete.length
      logger.log(chalk.bold(`Summary: ${totalChanges} total changes detected`))
      logger.log(chalk.dim('Run `sync` to apply these changes to the remote configuration.'))

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

    // Convert config to unified format if needed
    const { isUnifiedConfig } = await import('../lib/types')
    const { RuleTranslator } = await import('../lib/translators/RuleTranslator')
    let unifiedConfig

    if (isUnifiedConfig(config)) {
      unifiedConfig = config
    } else {
      // Convert legacy Vercel format to unified format
      logger.debug('Converting legacy Vercel config to unified format')
      const rules = config.rules.map((rule) => RuleTranslator.vercelToUnified(rule).result)
      const ips = (config.ips || []).map((ip) => RuleTranslator.vercelIPToUnified(ip))

      unifiedConfig = {
        version: '2.0',
        provider: provider.name,
        rules,
        ips,
        metadata: {
          version: config.version,
          updatedAt: config.updatedAt,
        },
      }
    }

    logger.start(`Calculating differences with ${providerName}...`)

    const changes = await provider.getChanges(unifiedConfig)

    if (!changes.hasChanges) {
      logger.success(chalk.green('No differences found. Local and remote configurations are in sync.'))
      return
    }

    if (argv.format === 'json') {
      // JSON output for programmatic use
      const diff = {
        provider: provider.name,
        customRules: {
          toAdd: changes.rulesToAdd.map((rule) => ({ ...rule, status: 'add' })),
          toUpdate: changes.rulesToUpdate.map((rule) => ({ ...rule, status: 'update' })),
          toDelete: changes.rulesToDelete.map((rule) => ({ ...rule, status: 'delete' })),
        },
        ipRules: {
          toAdd: (changes.ipsToAdd || []).map((rule) => ({ ...rule, status: 'add' })),
          toUpdate: (changes.ipsToUpdate || []).map((rule) => ({ ...rule, status: 'update' })),
          toDelete: (changes.ipsToDelete || []).map((rule) => ({ ...rule, status: 'delete' })),
        },
        summary: {
          hasChanges: changes.hasChanges,
          customRuleChanges: changes.rulesToAdd.length + changes.rulesToUpdate.length + changes.rulesToDelete.length,
          ipRuleChanges:
            (changes.ipsToAdd?.length || 0) + (changes.ipsToUpdate?.length || 0) + (changes.ipsToDelete?.length || 0),
        },
      }

      logger.log(JSON.stringify(diff, null, 2))
      return
    }

    // Table format (default) - convert to Vercel format for display
    logger.log(chalk.bold(`\n🔍 Configuration Differences (${providerName})\n`))

    const hasCustomRuleChanges =
      changes.rulesToAdd.length > 0 || changes.rulesToUpdate.length > 0 || changes.rulesToDelete.length > 0
    const hasIPRuleChanges =
      (changes.ipsToAdd?.length || 0) > 0 ||
      (changes.ipsToUpdate?.length || 0) > 0 ||
      (changes.ipsToDelete?.length || 0) > 0

    if (hasCustomRuleChanges) {
      logger.log(chalk.bold('Custom Rule Changes:\n'))
      const rulesToDisplay = [
        ...changes.rulesToAdd.map((rule) => {
          const vercelRule = RuleTranslator.unifiedToVercel(rule).result
          return { ...vercelRule, changeStatus: RULE_STATUS_MAP.new }
        }),
        ...changes.rulesToUpdate.map((rule) => {
          const vercelRule = RuleTranslator.unifiedToVercel(rule).result
          return { ...vercelRule, changeStatus: RULE_STATUS_MAP.modified }
        }),
        ...changes.rulesToDelete.map((rule) => {
          const vercelRule = RuleTranslator.unifiedToVercel(rule).result
          return { ...vercelRule, changeStatus: RULE_STATUS_MAP.deleted }
        }),
      ]

      displayRulesTable(rulesToDisplay, { showStatus: true })
      logger.log('')
    }

    if (hasIPRuleChanges) {
      logger.log(chalk.bold('IP Blocking Rule Changes:\n'))
      const ipsToDisplay = [
        ...(changes.ipsToAdd || []).map((rule) => ({
          ...rule,
          hostname: rule.hostname || '',
          changeStatus: RULE_STATUS_MAP.new,
        })),
        ...(changes.ipsToUpdate || []).map((rule) => ({
          ...rule,
          hostname: rule.hostname || '',
          changeStatus: RULE_STATUS_MAP.modified,
        })),
        ...(changes.ipsToDelete || []).map((rule) => ({
          ...rule,
          hostname: rule.hostname || '',
          changeStatus: RULE_STATUS_MAP.deleted,
        })),
      ]

      displayIPBlockingTable(ipsToDisplay, { showStatus: true })
      logger.log('')
    }

    // Summary
    const totalChanges =
      changes.rulesToAdd.length +
      changes.rulesToUpdate.length +
      changes.rulesToDelete.length +
      (changes.ipsToAdd?.length || 0) +
      (changes.ipsToUpdate?.length || 0) +
      (changes.ipsToDelete?.length || 0)
    logger.log(chalk.bold(`Summary: ${totalChanges} total changes detected`))
    logger.log(chalk.dim('Run `sync` to apply these changes to the remote configuration.'))
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error calculating diff:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    if (!argv.ci) {
      process.exit(1)
    }
  }
}
