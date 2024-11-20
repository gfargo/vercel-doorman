import { LogLevels } from 'consola'
import { logger } from '../logger'
import { RuleTransformer } from '../transformers/RuleTransformer'
import { ConfigRule, FirewallConfig } from '../types/configTypes'
import { VercelRule } from '../types/vercelTypes'
import { isDeepEqual } from '../utils/isDeepEqual'
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
      const existingRules = await this.client.fetchFirewallRules()
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
        await this.retryOperation(() => this.client.deleteFirewallRule(rule), retryAttempts)
        deletedRules.push(rule)
        logger.debug(`Rule deleted: ${rule.id}`)
      }

      // Add new rules
      for (const rule of toAdd) {
        const expectedId = `rule_${convertToSnakeCase(rule.name)}`
        logger.debug(`Adding new rule: ${rule.name}`)
        const newRule = await this.retryOperation(
          () => this.client.createFirewallRule(RuleTransformer.toVercelRule(rule)),
          retryAttempts,
        )
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
        const updatedRule = await this.retryOperation(() => this.client.updateFirewallRule(rule), retryAttempts)
        updatedRules.push(updatedRule)
        logger.debug(`Rule updated: ${updatedRule.id}`)
      }

      logger.success(
        `Sync completed. Added: ${addedRules.length}, Updated: ${updatedRules.length}, Deleted: ${deletedRules.length}`,
      )
      return { addedRules, updatedRules, deletedRules, rulesToUpdateLocally }
    } catch (error) {
      logger.error('Error during sync:', error)
      throw new Error('Failed to synchronize firewall rules. Please check the error logs and try again.')
    }
  }

  private async retryOperation<T>(operation: () => Promise<T>, attempts: number): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation()
      } catch (error) {
        if (i === attempts - 1) {
          logger.error(`Operation failed after ${attempts} attempts:`, error)
          throw error
        }
        const delay = Math.pow(2, i) * 1000
        logger.warn(`Operation failed, retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
    throw new Error('Retry attempts exhausted')
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
}
