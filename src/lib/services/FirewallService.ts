import { VercelClient } from '../fetchUtility'
import { logger } from '../logger'
import { RuleTransformer } from '../transformers/RuleTransformer'
import { ConfigRule, FirewallConfig } from '../types/configTypes'
import { VercelRule } from '../types/vercelTypes'

interface SyncOptions {
  batchSize?: number
  dryRun?: boolean
  retryAttempts?: number
}

export class FirewallService {
  constructor(private client: VercelClient) {}

  async syncRules(config: FirewallConfig, options: SyncOptions = {}): Promise<void> {
    const { batchSize = 10, dryRun = false, retryAttempts = 3 } = options

    try {
      const existingRules = await this.client.fetchFirewallRules()
      const configRules = config.rules

      const existingConfigRules = existingRules.map(RuleTransformer.fromVercelRule)

      const { toAdd, toUpdate, toDelete } = this.diffRules(configRules, existingConfigRules, existingRules)

      if (dryRun) {
        logger.info('Dry run mode. The following changes would be made:')
        logger.info(`Add: ${toAdd.length}, Update: ${toUpdate.length}, Delete: ${toDelete.length}`)
        return
      }

      const operations = [
        ...toDelete.map((rule) => () => this.retryOperation(() => this.client.deleteFirewallRule(rule), retryAttempts)),
        ...toAdd.map(
          (rule) => () =>
            this.retryOperation(
              () => this.client.updateFirewallRule(RuleTransformer.toVercelRule(rule)),
              retryAttempts,
            ),
        ),
        ...toUpdate.map((rule) => () => this.retryOperation(() => this.client.updateFirewallRule(rule), retryAttempts)),
      ]

      for (let i = 0; i < operations.length; i += batchSize) {
        const batch = operations.slice(i, i + batchSize)
        await Promise.all(batch.map((op) => op()))
      }

      logger.success(`Sync completed. Added: ${toAdd.length}, Updated: ${toUpdate.length}, Deleted: ${toDelete.length}`)
    } catch (error) {
      logger.error('Error during sync:', error)
      throw error
    }
  }

  private async retryOperation<T>(operation: () => Promise<T>, attempts: number): Promise<T> {
    for (let i = 0; i < attempts; i++) {
      try {
        return await operation()
      } catch (error) {
        if (i === attempts - 1) throw error
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 1000))
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
      const existingIndexById = existingConfigRules.findIndex((r) => r.id === configRule.id)
      const existingIndexByContent = existingConfigRules.findIndex((r) =>
        this.isDeepEqual(this.omitId(configRule), this.omitId(r)),
      )

      if (existingIndexById === -1 && existingIndexByContent === -1) {
        toAdd.push(configRule)
      } else if (existingIndexById === -1 && existingIndexByContent !== -1) {
        // Renamed rule
        toAdd.push(configRule)
        const deleteIndex = existingVercelRules[existingIndexByContent]
          ? toDelete.findIndex((r) => r.id === existingVercelRules[existingIndexByContent]?.id)
          : -1
        if (deleteIndex !== -1) toDelete.splice(deleteIndex, 1)
      } else {
        const existingRule = existingConfigRules[existingIndexById]
        const existingVercelRule = existingVercelRules[existingIndexById]

        const deleteIndex = existingVercelRule ? toDelete.findIndex((r) => r.id === existingVercelRule.id) : -1
        if (deleteIndex !== -1) toDelete.splice(deleteIndex, 1)

        if (existingRule && !this.isDeepEqual(this.omitId(configRule), this.omitId(existingRule))) {
          if (existingVercelRule) {
            const updatedRule = { ...RuleTransformer.toVercelRule(configRule), id: existingVercelRule.id }
            toUpdate.push(updatedRule)
          }
        }
      }
    }

    return { toAdd, toUpdate, toDelete }
  }

  private omitId(rule: ConfigRule): Omit<ConfigRule, 'id'> {
    const { id, ...rest } = rule
    return rest
  }

  private isDeepEqual(obj1: unknown, obj2: unknown): boolean {
    if (obj1 === obj2) return true
    if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) return false

    const keys1 = Object.keys(obj1)
    const keys2 = Object.keys(obj2)

    if (keys1.length !== keys2.length) return false

    for (const key of keys1) {
      if (
        !keys2.includes(key) ||
        !this.isDeepEqual((obj1 as Record<string, unknown>)[key], (obj2 as Record<string, unknown>)[key])
      )
        return false
    }

    return true
  }
}
