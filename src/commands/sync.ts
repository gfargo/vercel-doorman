import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { CustomRule, FirewallConfig, isUnifiedConfig, UnifiedConfig } from '../lib/types'
import { RuleTranslator } from '../lib/translators/RuleTranslator'
import { prompt } from '../lib/ui/prompt'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { displayIPBlockingTable, displayRulesTable, RULE_STATUS_MAP } from '../lib/ui/table'
import { getConfig, saveConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface SyncOptions {
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
  ci?: boolean
}

export const command = 'sync'
export const desc = 'Sync firewall rules with config file'

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

export const handler = async (argv: Arguments<SyncOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    // Load and validate config
    let config = await getConfig(argv.config)

    // Check if this is a legacy Vercel-only usage (backward compatibility)
    const configProvider = isUnifiedConfig(config) ? config.provider : undefined
    const isLegacyVercelUsage =
      !argv.provider && !configProvider && (argv.projectId || argv.teamId || argv.token || config.projectId)

    if (isLegacyVercelUsage) {
      // Use legacy Vercel-specific code path for backward compatibility
      logger.debug('Using legacy Vercel code path')

      const { token, projectId, teamId } = await promptForCredentials({
        token: argv.token,
        projectId: argv.projectId || config.projectId,
        teamId: argv.teamId || config.teamId,
      })

      const client = new VercelClient(projectId, teamId, token)
      const service = new FirewallService(client)

      logger.start(chalk.magenta('Calculating firewall configuration changes...'))
      const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } =
        await service.getChanges(config)

      const hasCustomRuleChanges = toAdd.length > 0 || toUpdate.length > 0 || toDelete.length > 0
      const hasIPRuleChanges = ipsToAdd.length > 0 || ipsToUpdate.length > 0 || ipsToDelete.length > 0
      const hasVersionChange = config.version !== version

      if (!hasCustomRuleChanges && !hasIPRuleChanges && !hasVersionChange) {
        logger.success(chalk.green('No changes detected. Firewall rules are in sync.'))
        return
      }

      if (hasCustomRuleChanges) {
        logger.log(chalk.bold('\nProposed Custom Rule Changes:\n'))
        displayRulesTable(
          [
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ...toAdd.map((rule: any) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id as string })),
            ...toUpdate.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.modified, id: rule.id as string })),
            ...toDelete.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.deleted, id: rule.id as string })),
          ],
          { showStatus: true },
        )
      }

      if (hasIPRuleChanges) {
        logger.log(chalk.bold('\nProposed IP Blocking Rule Changes:\n'))
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
      }

      if (hasVersionChange) {
        logger.log(chalk.bold('\nProposed Metadata Changes:\n'))
        logger.log(`  - Version: ${chalk.red(config.version)} ${chalk.dim('->')} ${chalk.green(version)}`)
      }

      const confirmed = await prompt('Do you want to apply these changes?', { type: 'confirm' })
      if (!confirmed) {
        logger.info(chalk.yellow('Sync cancelled.'))
        return
      }

      logger.start('Starting firewall rules sync...')

      // Create backup of original config
      const backupConfig = JSON.parse(JSON.stringify(config)) as FirewallConfig

      // Perform sync operation
      const syncResult = await service.syncRules(config, {
        debug: argv.debug,
      })
      const { rulesToUpdateLocally } = syncResult
      logger.success(chalk.green('Firewall rules sync completed successfully'))

      // Validate and update config metadata
      try {
        const updatedConfig = await service.validateAndUpdateConfig(config, syncResult, { dryRun: false })
        config = updatedConfig // Update our working copy
      } catch (error) {
        logger.error('Failed to validate sync result or update config metadata')
        logger.error(error instanceof Error ? error.message : String(error))

        // Write backup to config file
        await saveConfig(backupConfig, argv.config)

        logger.info(chalk.yellow('Restored original config due to validation failure'))
        throw new Error('Sync validation failed - original config restored')
      }

      if (rulesToUpdateLocally.length > 0) {
        logger.log('')
        logger.info(chalk.yellow('Some rules have IDs that do not match their expected snake_case name:'))
        rulesToUpdateLocally.forEach((rule) => {
          logger.log(
            `  - Rule "${rule.name}": ${chalk.red(rule.oldId || 'empty')} ${chalk.dim('->')} ${chalk.green(rule.newId)}`,
          )
        })

        const updateConfirmed = await prompt('Do you want to update the local config with the new IDs?', {
          type: 'confirm',
        })

        if (updateConfirmed) {
          // Update config with new IDs and preserve metadata
          const updatedConfig: FirewallConfig = {
            ...config,
            rules: config.rules.map((rule: CustomRule) => {
              const ruleToUpdate = rulesToUpdateLocally.find(
                (r) => r.oldId === rule.id || (r.oldId === '' && r.name === rule.name),
              )
              return ruleToUpdate ? { ...rule, id: ruleToUpdate.newId } : rule
            }),
            // Preserve IP blocking rules
            ips: config.ips || [],
          }

          await saveConfig(updatedConfig, argv.config)
          logger.success(chalk.green('Updated local config with new rule IDs'))
        } else {
          logger.warn(chalk.yellow('Local config not updated. Remember to update rule IDs manually if needed.'))
          logger.log('Changes:')
          rulesToUpdateLocally.forEach((rule) => {
            logger.log(
              `  - Rule "${rule.name}": ${chalk.red(rule.oldId || 'empty')} ${chalk.dim('->')} ${chalk.green(rule.newId)}`,
            )
          })
        }
      }

      // Always save config if version or metadata changed
      if (backupConfig.version !== config.version || backupConfig.updatedAt !== config.updatedAt) {
        await saveConfig(config, argv.config)
        logger.success(
          chalk.green(`Updated version ${chalk.dim(`(v${config.version})`)} and metadata in local config file`),
        )
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

    // Convert config to unified format if needed
    let unifiedConfig: UnifiedConfig

    if (isUnifiedConfig(config)) {
      unifiedConfig = config
    } else {
      // Convert legacy Vercel format to unified format
      logger.debug('Converting legacy Vercel config to unified format')
      const rules = config.rules.map((rule: CustomRule) => {
        const translation = RuleTranslator.vercelToUnified(rule)
        if (translation.warnings.length > 0) {
          translation.warnings.forEach((w) => logger.debug(`Rule ${rule.name}: ${w.message}`))
        }
        return translation.result
      })

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

    logger.start(chalk.magenta('Calculating firewall configuration changes...'))
    const changes = await provider.getChanges(unifiedConfig)

    if (!changes.hasChanges) {
      logger.success(chalk.green('No changes detected. Firewall rules are in sync.'))
      return
    }

    // Display proposed changes
    if (changes.rulesToAdd.length > 0 || changes.rulesToUpdate.length > 0 || changes.rulesToDelete.length > 0) {
      logger.log(chalk.bold('\\nProposed Custom Rule Changes:\\n'))

      // Convert unified rules to Vercel format for display compatibility
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
    }

    if (
      changes.ipsToAdd &&
      changes.ipsToUpdate &&
      changes.ipsToDelete &&
      (changes.ipsToAdd.length > 0 || changes.ipsToUpdate.length > 0 || changes.ipsToDelete.length > 0)
    ) {
      logger.log(chalk.bold('\\nProposed IP Blocking Rule Changes:\\n'))

      // UnifiedIPRule is compatible with VercelIPBlockingRule for display
      const ipsToDisplay = [
        ...changes.ipsToAdd.map((rule) => ({
          ...rule,
          hostname: rule.hostname || '',
          changeStatus: RULE_STATUS_MAP.new,
        })),
        ...changes.ipsToUpdate.map((rule) => ({
          ...rule,
          hostname: rule.hostname || '',
          changeStatus: RULE_STATUS_MAP.modified,
        })),
        ...changes.ipsToDelete.map((rule) => ({
          ...rule,
          hostname: rule.hostname || '',
          changeStatus: RULE_STATUS_MAP.deleted,
        })),
      ]

      displayIPBlockingTable(ipsToDisplay, { showStatus: true })
    }

    const confirmed = argv.ci || (await prompt('Do you want to apply these changes?', { type: 'confirm' }))
    if (!confirmed) {
      logger.info(chalk.yellow('Sync cancelled.'))
      return
    }

    logger.start(`Syncing firewall rules to ${providerName}...`)

    // Perform sync operation
    const syncResult = await provider.syncRules(unifiedConfig)

    if (!syncResult.success) {
      logger.error(chalk.red('Sync failed!'))
      if (syncResult.errors && syncResult.errors.length > 0) {
        syncResult.errors.forEach((error) => logger.error(`  - ${error}`))
      }
      process.exit(1)
    }

    logger.success(chalk.green(`Firewall rules synced successfully to ${providerName}`))
    logger.log(`  Rules added: ${syncResult.rulesAdded}`)
    logger.log(`  Rules updated: ${syncResult.rulesUpdated}`)
    logger.log(`  Rules deleted: ${syncResult.rulesDeleted}`)

    if (
      syncResult.ipsAdded !== undefined ||
      syncResult.ipsUpdated !== undefined ||
      syncResult.ipsDeleted !== undefined
    ) {
      logger.log(`  IP rules added: ${syncResult.ipsAdded || 0}`)
      logger.log(`  IP rules updated: ${syncResult.ipsUpdated || 0}`)
      logger.log(`  IP rules deleted: ${syncResult.ipsDeleted || 0}`)
    }

    if (syncResult.warnings && syncResult.warnings.length > 0) {
      logger.log('')
      logger.warn(chalk.yellow('Warnings:'))
      syncResult.warnings.forEach((warning) => logger.warn(`  - ${warning}`))
    }
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
