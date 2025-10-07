import chalk from 'chalk'
import { LogLevels } from 'consola'
import { logger } from '../../logger'
import { BaseFirewallService } from '../BaseFirewallService'
import { VercelClient } from './VercelClient'
import { RuleTranslator } from '../../translators'
import { isDeepEqual } from '../../utils/isDeepEqual'
import { omitId } from '../../utils/omitId'
import { retry } from '../../utils/retry'
import { convertToSnakeCase } from '../../utils/toSnakeCase'
import { firewallConfigSchema } from '../../schemas/firewallSchemas'
import type {
  IFirewallProvider,
  ProviderType,
  SyncOptions,
  SyncResult,
  ChangeSet,
  FeatureSet,
  HealthScore,
  HealthIssue,
  ValidationResult,
} from '../IFirewallProvider'
import type { UnifiedConfig, UnifiedRule, UnifiedIPRule } from '../../types/unified'
import type { CustomRule, IPBlockingRule } from '../../types/vercel'

/**
 * Vercel Firewall Service
 * Implements IFirewallProvider for Vercel Firewall
 */
export class VercelFirewallService extends BaseFirewallService implements IFirewallProvider {
  public readonly name: ProviderType = 'vercel'

  constructor(private client: VercelClient) {
    super()
  }

  /**
   * Fetch configuration from Vercel
   */
  async fetchConfig(version?: number): Promise<UnifiedConfig> {
    try {
      logger.debug('Fetching Vercel firewall configuration')
      const vercelConfig = await this.client.fetchFirewallConfig(version)

      // Convert Vercel format to unified format
      const rules: UnifiedRule[] = vercelConfig.rules.map((rule) => {
        const translation = RuleTranslator.vercelToUnified(rule)
        if (translation.warnings.length > 0) {
          translation.warnings.forEach((w) => logger.warn(`Rule ${rule.name}: ${w.message}`))
        }
        return translation.result
      })

      const ips: UnifiedIPRule[] = vercelConfig.ips.map((ip) => RuleTranslator.vercelIPToUnified(ip))

      return {
        version: '2.0',
        provider: 'vercel',
        rules,
        ips,
        metadata: {
          version: vercelConfig.version,
          updatedAt: vercelConfig.updatedAt,
        },
      }
    } catch (error) {
      logger.error('Error fetching Vercel configuration:', error)
      throw new Error('Failed to fetch Vercel firewall configuration')
    }
  }

  /**
   * Sync rules to Vercel
   */
  async syncRules(config: UnifiedConfig, options: SyncOptions = {}): Promise<SyncResult> {
    const { dryRun = false, retryAttempts = 3, debug = false } = options

    if (debug) {
      logger.level = LogLevels.debug
    }

    try {
      const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } = await this.getChanges(config)

      if (dryRun) {
        logger.info('Dry run mode. The following changes would be made:')
        logger.info(`Custom Rules - Add: ${toAdd.length}, Update: ${toUpdate.length}, Delete: ${toDelete.length}`)
        logger.info(`IP Rules - Add: ${ipsToAdd.length}, Update: ${ipsToUpdate.length}, Delete: ${ipsToDelete.length}`)
        return {
          rulesAdded: 0,
          rulesUpdated: 0,
          rulesDeleted: 0,
          ipsAdded: 0,
          ipsUpdated: 0,
          ipsDeleted: 0,
          version,
        }
      }

      const addedRules: CustomRule[] = []
      const updatedRules: CustomRule[] = []
      const deletedRules: CustomRule[] = []

      const addedIPRules: IPBlockingRule[] = []
      const updatedIPRules: IPBlockingRule[] = []
      const deletedIPRules: IPBlockingRule[] = []

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
        const newRule = await retry(() => this.client.createFirewallRule(rule), {
          maxAttempts: retryAttempts,
        })
        addedRules.push(newRule)
        logger.debug(`New custom rule added: ${newRule.id}`)
      }

      // Add new IP blocking rules
      for (const rule of ipsToAdd) {
        logger.debug(`Adding new IP blocking rule: ${rule.ip}`)
        const newIPRule = await retry(() => this.client.createIPBlockingRule(rule), {
          maxAttempts: retryAttempts,
        })
        addedIPRules.push(newIPRule)
        logger.debug(`New IP blocking rule added: (hostname): ${newIPRule.hostname} (ip): ${newIPRule.ip}`)
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

      // Fetch updated version
      const activeConfig = await this.client.fetchFirewallConfig()

      return {
        rulesAdded: addedRules.length,
        rulesUpdated: updatedRules.length,
        rulesDeleted: deletedRules.length,
        ipsAdded: addedIPRules.length,
        ipsUpdated: updatedIPRules.length,
        ipsDeleted: deletedIPRules.length,
        version: activeConfig.version,
      }
    } catch (error) {
      logger.error('Error during sync:', error)
      throw new Error('Failed to synchronize firewall rules')
    }
  }

  /**
   * Get changes between local and remote configuration
   */
  async getChanges(config: UnifiedConfig): Promise<
    ChangeSet & {
      version: number
      toAdd: CustomRule[]
      toUpdate: CustomRule[]
      toDelete: CustomRule[]
      ipsToAdd: IPBlockingRule[]
      ipsToUpdate: IPBlockingRule[]
      ipsToDelete: IPBlockingRule[]
    }
  > {
    try {
      logger.debug('Fetching existing firewall configuration')
      const activeConfig = await this.client.fetchFirewallConfig()
      logger.debug(`Fetched ${activeConfig.rules.length} custom rules and ${activeConfig.ips.length} IP blocking rules`)

      // Convert unified rules back to Vercel format for comparison
      const configRules: CustomRule[] = config.rules.map((rule) => {
        const translation = RuleTranslator.unifiedToVercel(rule)
        if (translation.warnings.length > 0) {
          translation.warnings.forEach((w) => logger.warn(`Rule ${rule.name}: ${w.message}`))
        }
        return translation.result
      })

      // Handle custom rules
      const { toAdd, toUpdate, toDelete } = this.diffRules(configRules, activeConfig.rules)

      // Convert unified IP rules back to Vercel format
      const configIPs: IPBlockingRule[] = (config.ips || []).map((ip) => ({
        id: ip.id || '',
        ip: ip.ip,
        hostname: ip.hostname,
        action: ip.action as 'deny',
        notes: ip.notes,
      }))

      // Handle IP blocking rules
      const { ipsToAdd, ipsToUpdate, ipsToDelete } = this.diffIPRules(configIPs, activeConfig.ips)

      return {
        version: activeConfig.version,
        toAdd,
        toUpdate,
        toDelete,
        ipsToAdd,
        ipsToUpdate,
        ipsToDelete,
        rules: {
          added: toAdd.length,
          updated: toUpdate.length,
          deleted: toDelete.length,
        },
        ips: {
          added: ipsToAdd.length,
          updated: ipsToUpdate.length,
          deleted: ipsToDelete.length,
        },
      }
    } catch (error) {
      logger.error('Error fetching existing firewall configuration:', error)
      throw new Error('Failed to fetch existing firewall configuration')
    }
  }

  /**
   * Get supported features for Vercel provider
   */
  getSupportedFeatures(): FeatureSet {
    return {
      customRules: true,
      ipBlocking: true,
      rateLimiting: true,
      geoBlocking: true,
      managedRules: false, // Vercel CRS is enterprise only
      logOnly: true,
      bypassRules: true,
      redirect: true,
      challenge: true,
    }
  }

  /**
   * Verify Vercel credentials
   */
  async verifyCredentials(): Promise<boolean> {
    return this.client.verifyCredentials()
  }

  /**
   * Validate Vercel-specific configuration
   */
  public validateConfig(config: UnifiedConfig): ValidationResult {
    // First run base validation
    const baseValidation = super.validateConfig(config)

    // Add Vercel-specific validation
    const errors = [...baseValidation.errors]
    const warnings = [...baseValidation.warnings]

    // Check for Vercel-specific requirements
    if (config.provider && config.provider !== 'vercel') {
      errors.push({
        path: 'provider',
        message: `Provider must be 'vercel' for VercelFirewallService`,
        code: 'INVALID_PROVIDER',
      })
    }

    // Validate against Vercel schema if available
    try {
      const validationResult = firewallConfigSchema.safeParse(config)
      if (!validationResult.success) {
        errors.push({
          path: 'root',
          message: `Schema validation failed: ${validationResult.error.message}`,
          code: 'SCHEMA_VALIDATION_FAILED',
        })
      }
    } catch (error) {
      logger.debug('Schema validation error:', error)
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Get health score with Vercel-specific checks
   */
  public getHealthScore(config: UnifiedConfig): HealthScore {
    const baseScore = super.getHealthScore(config)

    // Add Vercel-specific health checks
    const issues: HealthIssue[] = [...baseScore.issues]
    let score = baseScore.score

    // Check for rate limiting rules
    const rateLimitRules = config.rules.filter((r) => r.action?.type === 'rate_limit')
    if (rateLimitRules.length === 0) {
      score -= 10
      issues.push({
        severity: 'info',
        category: 'security',
        message: 'No rate limiting rules configured',
        suggestion: 'Consider adding rate limiting to protect against abuse',
      })
    }

    // Check for IP blocking
    if (!config.ips || config.ips.length === 0) {
      issues.push({
        severity: 'info',
        category: 'security',
        message: 'No IP blocking rules configured',
        suggestion: 'Consider blocking known malicious IPs',
      })
    }

    return {
      score: Math.max(0, score),
      grade: baseScore.grade,
      issues,
      recommendations: baseScore.recommendations,
    }
  }

  /**
   * Diff custom rules
   */
  private diffRules(
    configRules: CustomRule[],
    existingRules: CustomRule[],
  ): {
    toAdd: CustomRule[]
    toUpdate: CustomRule[]
    toDelete: CustomRule[]
  } {
    const toAdd: CustomRule[] = []
    const toUpdate: CustomRule[] = []
    const toDelete = [...existingRules]

    for (const configRule of configRules) {
      const existingRule = existingRules.find((r) => r.id === configRule.id)
      if (!existingRule) {
        toAdd.push(configRule)
      } else {
        if (!isDeepEqual(omitId(configRule), omitId(existingRule))) {
          toUpdate.push({ ...configRule, id: existingRule.id })
        }
        const deleteIndex = toDelete.findIndex((r) => r.id === existingRule.id)
        if (deleteIndex !== -1) {
          toDelete.splice(deleteIndex, 1)
        }
      }
    }

    return { toAdd, toUpdate, toDelete }
  }

  /**
   * Diff IP blocking rules
   */
  private diffIPRules(
    configRules: IPBlockingRule[],
    existingRules: IPBlockingRule[],
  ): {
    ipsToAdd: IPBlockingRule[]
    ipsToUpdate: IPBlockingRule[]
    ipsToDelete: IPBlockingRule[]
  } {
    const ipsToAdd: IPBlockingRule[] = []
    const ipsToUpdate: IPBlockingRule[] = []
    const ipsToDelete = [...existingRules]

    for (const configRule of configRules) {
      const existingRule = existingRules.find((r) => r.id === configRule.id)
      if (!existingRule) {
        logger.debug('Rule not found in existing rules:', { configRule })
        ipsToAdd.push(configRule)
      } else {
        if (!isDeepEqual(omitId(configRule), omitId(existingRule))) {
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
}
