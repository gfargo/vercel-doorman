import chalk from 'chalk'
import { LogLevels } from 'consola'
import { logger } from '../logger'
import { RuleTransformer } from '../transformers/RuleTransformer'
import { CustomRule, FirewallConfig, IPBlockingRule } from '../types/configTypes'
import { VercelIPBlockingRule, VercelRule } from '../types/vercelTypes'
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
    version: number
    toAdd: CustomRule[]
    toUpdate: VercelRule[]
    toDelete: VercelRule[]
    ipsToAdd: IPBlockingRule[]
    ipsToUpdate: VercelIPBlockingRule[]
    ipsToDelete: VercelIPBlockingRule[]
  }> {
    try {
      logger.debug('Fetching existing firewall configuration')
      const activeConfig = await this.client.fetchActiveFirewallConfig()
      logger.debug(`Fetched ${activeConfig.rules.length} custom rules and ${activeConfig.ips.length} IP blocking rules`)

      // Handle custom rules
      const configRules = config.rules
      const existingConfigRules = activeConfig.rules.map(RuleTransformer.fromVercelRule)
      const { toAdd, toUpdate, toDelete } = this.diffRules(configRules, existingConfigRules, activeConfig.rules)

      // Handle IP blocking rules
      const { ipsToAdd, ipsToUpdate, ipsToDelete } = this.diffIPRules(config.ips || [], activeConfig.ips)

      return {
        version: activeConfig.version,
        toAdd,
        toUpdate,
        toDelete,
        ipsToAdd,
        ipsToUpdate,
        ipsToDelete,
      }
    } catch (error) {
      logger.error('Error fetching existing firewall configuration:', error)
      throw new Error(
        'Failed to fetch existing firewall configuration. Please check your network connection and try again.',
      )
    }
  }

  async syncRules(
    config: FirewallConfig,
    options: SyncOptions = {},
  ): Promise<{
    addedRules: VercelRule[]
    updatedRules: VercelRule[]
    deletedRules: VercelRule[]
    addedIPRules: VercelIPBlockingRule[]
    updatedIPRules: VercelIPBlockingRule[]
    deletedIPRules: VercelIPBlockingRule[]
    rulesToUpdateLocally: { oldId: string; newId: string; name: string }[]
  }> {
    const { dryRun = false, retryAttempts = 3, debug = false } = options

    if (debug) {
      logger.level = LogLevels.debug
    }

    try {
      const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete } = await this.getChanges(config)

      if (dryRun) {
        logger.info('Dry run mode. The following changes would be made:')
        logger.info(`Custom Rules - Add: ${toAdd.length}, Update: ${toUpdate.length}, Delete: ${toDelete.length}`)
        logger.info(`IP Rules - Add: ${ipsToAdd.length}, Update: ${ipsToUpdate.length}, Delete: ${ipsToDelete.length}`)
        return {
          addedRules: [],
          updatedRules: [],
          deletedRules: [],
          addedIPRules: [],
          updatedIPRules: [],
          deletedIPRules: [],
          rulesToUpdateLocally: [],
        }
      }

      const addedRules: VercelRule[] = []
      const updatedRules: VercelRule[] = []
      const deletedRules: VercelRule[] = []
      const addedIPRules: VercelIPBlockingRule[] = []
      const updatedIPRules: VercelIPBlockingRule[] = []
      const deletedIPRules: VercelIPBlockingRule[] = []
      const rulesToUpdateLocally: { oldId: string; newId: string; name: string }[] = []

      // Delete custom rules
      for (const rule of toDelete) {
        logger.debug(`Deleting custom rule: ${rule.id}`)
        await retry(() => this.client.deleteFirewallRule(rule), { maxAttempts: retryAttempts })
        deletedRules.push(rule)
        logger.debug(`Custom rule deleted: ${rule.id}`)
      }

      // Delete IP blocking rules
      for (const rule of ipsToDelete) {
        logger.debug(`Deleting IP blocking rule: ${rule.id}`)
        await retry(() => this.client.deleteIPBlockingRule(rule), { maxAttempts: retryAttempts })
        deletedIPRules.push(rule)
        logger.debug(`IP blocking rule deleted: ${rule.id}`)
      }

      // Add new custom rules
      for (const rule of toAdd) {
        const expectedId = `rule_${convertToSnakeCase(rule.name)}`
        logger.debug(`Adding new custom rule: ${rule.name}`)
        const newRule = await retry(() => this.client.createFirewallRule(RuleTransformer.toVercelRule(rule)), {
          maxAttempts: retryAttempts,
        })
        addedRules.push(newRule)
        logger.debug(`New custom rule added: ${newRule.id}`)

        if (rule.id !== expectedId) {
          rulesToUpdateLocally.push({ oldId: rule.id ?? '', newId: expectedId, name: rule.name })
          logger.debug(`Rule ID needs update locally: ${rule.id} -> ${expectedId}`)
        }
      }

      // Add new IP blocking rules
      for (const rule of ipsToAdd) {
        logger.debug(`Adding new IP blocking rule: ${rule.ip}`)
        const newRule = await retry(() => this.client.createIPBlockingRule(rule), {
          maxAttempts: retryAttempts,
        })
        addedIPRules.push(newRule)
        logger.debug(`New IP blocking rule added: ${newRule.id}`)
      }

      // Update existing custom rules
      for (const rule of toUpdate) {
        logger.debug(`Updating custom rule: ${rule.id}`)
        const updatedRule = await retry(() => this.client.updateFirewallRule(rule), { maxAttempts: retryAttempts })
        updatedRules.push(updatedRule)
        logger.debug(`Custom rule updated: ${updatedRule.id}`)
      }

      // Update existing IP blocking rules
      for (const rule of ipsToUpdate) {
        logger.debug(`Updating IP blocking rule: ${rule.id}`)
        const updatedRule = await retry(() => this.client.updateIPBlockingRule(rule), { maxAttempts: retryAttempts })
        updatedIPRules.push(updatedRule)
        logger.debug(`IP blocking rule updated: ${updatedRule.id}`)
      }

      logger.debug(
        `${chalk.underline('Custom Rules:')} ${chalk.green('Added:')} ${chalk.green(addedRules.length)}, ` +
          `${chalk.cyan('Updated:')} ${chalk.cyan(updatedRules.length)}, ${chalk.red('Deleted:')} ${chalk.red(deletedRules.length)}`,
      )
      logger.debug(
        `${chalk.underline('IP Rules:')} ${chalk.green('Added:')} ${chalk.green(addedIPRules.length)}, ` +
          `${chalk.cyan('Updated:')} ${chalk.cyan(updatedIPRules.length)}, ${chalk.red('Deleted:')} ${chalk.red(deletedIPRules.length)}`,
      )

      return {
        addedRules,
        updatedRules,
        deletedRules,
        addedIPRules,
        updatedIPRules,
        deletedIPRules,
        rulesToUpdateLocally,
      }
    } catch (error) {
      logger.error('Error during sync:', error)
      throw new Error('Failed to synchronize firewall rules. Please check the error logs and try again.')
    }
  }

  private diffRules(
    configRules: CustomRule[],
    existingConfigRules: CustomRule[],
    existingVercelRules: VercelRule[],
  ): {
    toAdd: CustomRule[]
    toUpdate: VercelRule[]
    toDelete: VercelRule[]
  } {
    const toAdd: CustomRule[] = []
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

  private omitId(rule: CustomRule): Omit<CustomRule, 'id'> {
    const { id, ...rest } = rule
    return rest
  }

  private omitIPId(rule: IPBlockingRule | VercelIPBlockingRule): Omit<IPBlockingRule, 'id'> {
    const { id, ...rest } = rule
    return rest
  }

  private diffIPRules(
    configRules: IPBlockingRule[],
    existingRules: VercelIPBlockingRule[],
  ): {
    ipsToAdd: IPBlockingRule[]
    ipsToUpdate: VercelIPBlockingRule[]
    ipsToDelete: VercelIPBlockingRule[]
  } {
    const ipsToAdd: IPBlockingRule[] = []
    const ipsToUpdate: VercelIPBlockingRule[] = []
    const ipsToDelete = [...existingRules]

    for (const configRule of configRules) {
      const existingRule = existingRules.find((r) => r.id === configRule.id)
      if (!existingRule) {
        ipsToAdd.push(configRule)
      } else {
        if (!isDeepEqual(this.omitIPId(configRule), this.omitIPId(existingRule))) {
          ipsToUpdate.push({ ...existingRule, ...configRule })
        }
        const deleteIndex = ipsToDelete.findIndex((r) => r.id === existingRule.id)
        if (deleteIndex !== -1) {
          ipsToDelete.splice(deleteIndex, 1)
        }
      }
    }

    return { ipsToAdd, ipsToUpdate, ipsToDelete }
  }

  async validateAndUpdateConfig(
    config: FirewallConfig,
    syncResult: {
      addedRules: VercelRule[]
      updatedRules: VercelRule[]
      deletedRules: VercelRule[]
      addedIPRules: VercelIPBlockingRule[]
      updatedIPRules: VercelIPBlockingRule[]
      deletedIPRules: VercelIPBlockingRule[]
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
    const remoteIPRules = activeConfig.ips

    // Validate custom rules match expected state
    const addedIds = new Set(syncResult.addedRules.map((r) => r.id))

    // Validate IP rules match expected state
    const addedIPIds = new Set(syncResult.addedIPRules.map((r) => r.id))
    const updatedIds = new Set(syncResult.updatedRules.map((r) => r.id))
    const deletedIds = new Set(syncResult.deletedRules.map((r) => r.id))
    const updatedIPIds = new Set(syncResult.updatedIPRules.map((r) => r.id))
    const deletedIPIds = new Set(syncResult.deletedIPRules.map((r) => r.id))

    // Check if all remote custom rules match our expectations
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

    // Check if all remote IP rules match our expectations
    const unexpectedIPRules = remoteIPRules.filter((remoteRule) => {
      // Skip rules we just added or updated
      if (addedIPIds.has(remoteRule.id) || updatedIPIds.has(remoteRule.id)) {
        return false
      }
      // Rule should not exist if we deleted it
      if (deletedIPIds.has(remoteRule.id)) {
        return true
      }
      // Rule should match our local config if unchanged
      const localRule = config.ips.find((r) => r.id === remoteRule.id)
      if (!localRule) {
        return true
      }

      // Compare rule contents (excluding id)
      const isDeepEq = isDeepEqual(this.omitIPId(remoteRule), this.omitIPId(localRule))
      return !isDeepEq
    })

    const errors: string[] = []

    if (unexpectedRules.length > 0) {
      const errorDetails = unexpectedRules.map((rule) => `  - ${rule.name} (${rule.id})`).join('\n')
      errors.push('The following custom rules have unexpected state:\n' + errorDetails)
    }

    if (unexpectedIPRules.length > 0) {
      const errorDetails = unexpectedIPRules.map((rule) => `  - ${rule.ip} (${rule.id})`).join('\n')
      errors.push('The following IP blocking rules have unexpected state:\n' + errorDetails)
    }

    if (errors.length > 0) {
      throw new Error('Firewall configuration validation failed:\n' + errors.join('\n\n'))
    }

    // Update local config with new metadata
    return {
      ...config,
      version: activeConfig.version,
      updatedAt: activeConfig.updatedAt,
    }
  }
}
