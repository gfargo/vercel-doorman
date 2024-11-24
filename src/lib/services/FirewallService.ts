import chalk from 'chalk'
import { LogLevels } from 'consola'
import { logger } from '../logger'
import { RuleTransformer } from '../transformers/RuleTransformer'
import { ConfigRule, FirewallConfig } from '../types/configTypes'
import { VercelRule } from '../types/vercelTypes'
import { isDeepEqual } from '../utils/isDeepEqual'
import { retry } from '../utils/retry'
import { convertToSnakeCase } from '../utils/toSnakeCase'
import { VercelClient } from './VercelClient'

interface SyncOptions {
  dryRun?: boolean
  retryAttempts?: number
  debug?: boolean
}

export class FirewallService {
  constructor(private client: VercelClient) {}

  async getChanges(config: FirewallConfig): Promise<{
    toAdd: ConfigRule[]
    toUpdate: VercelRule[]
    toDelete: VercelRule[]
  }> {
    try {
      logger.debug('Fetching existing firewall rules')
      const existingRules = await this.client.fetchActiveFirewallRules()
      logger.debug(`Fetched ${existingRules.length} existing rules`)

      const configRules = config.rules
      const existingConfigRules = existingRules.map(RuleTransformer.fromVercelRule)
      return this.diffRules(configRules, existingConfigRules, existingRules)
    } catch (error) {
      logger.error('Error fetching existing firewall rules:', error)
      throw new Error('Failed to fetch existing firewall rules. Please check your network connection and try again.')
    }
  }

  async syncRules(
    config: FirewallConfig,
    options: SyncOptions = {},
  ): Promise<{
    addedRules: VercelRule[]
    updatedRules: VercelRule[]
    deletedRules: VercelRule[]
    rulesToUpdateLocally: { oldId: string; newId: string; name: string }[]
  }> {
    const { dryRun = false, retryAttempts = 3, debug = false } = options

    if (debug) {
      logger.level = LogLevels.debug
    }

    try {
      const { toAdd, toUpdate, toDelete } = await this.getChanges(config)

      if (dryRun) {
        logger.info('Dry run mode. The following changes would be made:')
        logger.info(`Add: ${toAdd.length}, Update: ${toUpdate.length}, Delete: ${toDelete.length}`)
        return { addedRules: [], updatedRules: [], deletedRules: [], rulesToUpdateLocally: [] }
      }

      const addedRules: VercelRule[] = []
      const updatedRules: VercelRule[] = []
      const deletedRules: VercelRule[] = []
      const rulesToUpdateLocally: { oldId: string; newId: string; name: string }[] = []

      // Delete rules
      for (const rule of toDelete) {
        logger.debug(`Deleting rule: ${rule.id}`)
        await retry(() => this.client.deleteFirewallRule(rule), { maxAttempts: retryAttempts })
        deletedRules.push(rule)
        logger.debug(`Rule deleted: ${rule.id}`)
      }

      // Add new rules
      for (const rule of toAdd) {
        const expectedId = `rule_${convertToSnakeCase(rule.name)}`
        logger.debug(`Adding new rule: ${rule.name}`)
        const newRule = await retry(() => this.client.createFirewallRule(RuleTransformer.toVercelRule(rule)), {
          maxAttempts: retryAttempts,
        })
        addedRules.push(newRule)
        logger.debug(`New rule added: ${newRule.id}`)

        if (rule.id !== expectedId) {
          rulesToUpdateLocally.push({ oldId: rule.id ?? '', newId: expectedId, name: rule.name })
          logger.debug(`Rule ID needs update locally: ${rule.id} -> ${expectedId}`)
        }
      }

      // Update existing rules
      for (const rule of toUpdate) {
        logger.debug(`Updating rule: ${rule.id}`)
        const updatedRule = await retry(() => this.client.updateFirewallRule(rule), { maxAttempts: retryAttempts })
        updatedRules.push(updatedRule)
        logger.debug(`Rule updated: ${updatedRule.id}`)
      }

      logger.success(
        `Sync completed. Added: ${chalk.green(addedRules.length)}, Updated: ${chalk.cyan(updatedRules.length)}, Deleted: ${chalk.red(deletedRules.length)}`,
      )
      return { addedRules, updatedRules, deletedRules, rulesToUpdateLocally }
    } catch (error) {
      logger.error('Error during sync:', error)
      throw new Error('Failed to synchronize firewall rules. Please check the error logs and try again.')
    }
  }

  private diffRules(
    configRules: ConfigRule[],
    existingConfigRules: ConfigRule[],
    existingVercelRules: VercelRule[],
  ): {
    toAdd: ConfigRule[]
    toUpdate: VercelRule[]
    toDelete: VercelRule[]
  } {
    const toAdd: ConfigRule[] = []
    const toUpdate: VercelRule[] = []
    const toDelete = [...existingVercelRules]

    for (const configRule of configRules) {
      const existingRule = existingConfigRules.find((r) => r.id === configRule.id)
      if (!existingRule) {
        toAdd.push(configRule)
      } else {
        const existingVercelRule = existingVercelRules.find((r) => r.id === configRule.id)
        if (existingVercelRule && !isDeepEqual(this.omitId(configRule), this.omitId(existingRule))) {
          toUpdate.push({ ...RuleTransformer.toVercelRule(configRule), id: existingVercelRule.id })
        }
        const deleteIndex = toDelete.findIndex((r) => r.id === existingVercelRule?.id)
        if (deleteIndex !== -1) {
          toDelete.splice(deleteIndex, 1)
        }
      }
    }

    return { toAdd, toUpdate, toDelete }
  }

  private omitId(rule: ConfigRule): Omit<ConfigRule, 'id'> {
    const { id, ...rest } = rule
    return rest
  }

  async validateAndUpdateConfig(
    config: FirewallConfig,
    syncResult: {
      addedRules: VercelRule[]
      updatedRules: VercelRule[]
      deletedRules: VercelRule[]
    },
    options: { dryRun?: boolean } = {},
  ): Promise<FirewallConfig> {
    if (options.dryRun) {
      logger.info(chalk.cyan('Dry run: Config metadata would be updated after successful sync'))
      return config
    }

    // Add delay to allow changes to propagate
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Fetch latest config with retries
    const activeConfig = await retry(() => this.client.fetchActiveFirewallConfig(), {
      maxAttempts: 3,
      delayMs: 1000,
      backoff: true,
    })

    // Transform rules for comparison
    const transformedLocalRules = config.rules.map(RuleTransformer.toVercelRule)
    const remoteRules = activeConfig.rules

    // Validate rules match expected state
    const addedIds = new Set(syncResult.addedRules.map((r) => r.id))
    const updatedIds = new Set(syncResult.updatedRules.map((r) => r.id))
    const deletedIds = new Set(syncResult.deletedRules.map((r) => r.id))

    // Check if all remote rules match our expectations
    const unexpectedRules = remoteRules.filter((remoteRule) => {
      // Skip rules we just added or updated
      if (addedIds.has(remoteRule.id) || updatedIds.has(remoteRule.id)) {
        return false
      }
      // Rule should not exist if we deleted it
      if (deletedIds.has(remoteRule.id)) {
        return true
      }
      // Rule should match our local config if unchanged
      const localRule = transformedLocalRules.find((r) => r.id === remoteRule.id)
      if (!localRule) {
        return true
      }
      // Compare rule contents (excluding id)
      const { id: _rid1, ...remoteRuleContent } = remoteRule
      const { id: _rid2, ...localRuleContent } = localRule
      return !isDeepEqual(remoteRuleContent, localRuleContent)
    })

    if (unexpectedRules.length > 0) {
      const errorDetails = unexpectedRules.map((rule) => `  - ${rule.name} (${rule.id})`).join('\n')
      throw new Error(
        'Firewall configuration validation failed. The following rules have unexpected state:\n' + errorDetails,
      )
    }

    // Update local config with new metadata
    return {
      ...config,
      version: activeConfig.version,
      updatedAt: activeConfig.updatedAt,
    }
  }
}
