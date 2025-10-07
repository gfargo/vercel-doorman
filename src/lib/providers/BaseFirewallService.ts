import { logger } from '../logger'
import type {
  IFirewallProvider,
  ProviderType,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  HealthScore,
  HealthIssue,
  SyncResult,
} from './IFirewallProvider'
import type { UnifiedConfig, UnifiedRule } from '../types/unified'

/**
 * Comparison function type for diffing
 */
export type CompareFn<T> = (a: T, b: T) => boolean

/**
 * Diff result type
 */
export interface DiffResult<T> {
  toAdd: T[]
  toUpdate: T[]
  toDelete: T[]
}

/**
 * Abstract base service class providing common functionality for firewall providers
 * Includes diffing logic, validation helpers, and metadata management
 */
export abstract class BaseFirewallService implements IFirewallProvider {
  abstract readonly name: ProviderType

  // Abstract methods that must be implemented by provider-specific services
  abstract fetchConfig(version?: number): Promise<UnifiedConfig>
  abstract syncRules(config: UnifiedConfig, options?: import('./IFirewallProvider').SyncOptions): Promise<unknown>
  abstract getChanges(config: UnifiedConfig): Promise<import('./IFirewallProvider').ChangeSet>
  abstract getSupportedFeatures(): import('./IFirewallProvider').FeatureSet
  abstract verifyCredentials(): Promise<boolean>

  /**
   * Validate configuration
   * Base implementation that can be extended by providers
   */
  public validateConfig(config: UnifiedConfig): ValidationResult {
    const errors: ValidationError[] = []
    const warnings: ValidationWarning[] = []

    // Basic validation
    if (!config) {
      errors.push({
        path: 'root',
        message: 'Configuration is required',
        code: 'CONFIG_REQUIRED',
      })
    }

    if (config && !config.rules) {
      errors.push({
        path: 'rules',
        message: 'Rules array is required',
        code: 'RULES_REQUIRED',
      })
    }

    if (config && (config as unknown as { rules: unknown }).rules && !Array.isArray(config.rules)) {
      errors.push({
        path: 'rules',
        message: 'Rules must be an array',
        code: 'RULES_INVALID_TYPE',
      })
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  /**
   * Calculate configuration health score
   * Base implementation that can be extended by providers
   */
  public getHealthScore(config: UnifiedConfig): HealthScore {
    const issues: HealthIssue[] = []
    let score = 100

    // Check if config exists
    if (!config) {
      return {
        score: 0,
        grade: 'poor',
        issues: [
          {
            severity: 'error',
            category: 'configuration',
            message: 'No configuration found',
          },
        ],
        recommendations: ['Create a configuration file'],
      }
    }

    // Check for rules
    if (!config.rules || config.rules.length === 0) {
      score -= 20
      issues.push({
        severity: 'warning',
        category: 'rules',
        message: 'No rules defined',
        suggestion: 'Add security rules to protect your application',
      })
    }

    // Check for rule descriptions
    if (config.rules && config.rules.length > 0) {
      const rulesWithoutDescription = config.rules.filter((r: UnifiedRule) => !r.description)
      if (rulesWithoutDescription.length > 0) {
        score -= 5
        issues.push({
          severity: 'info',
          category: 'maintainability',
          message: `${rulesWithoutDescription.length} rule(s) missing descriptions`,
          suggestion: 'Add descriptions to improve maintainability',
        })
      }
    }

    // Check for disabled rules
    if (config.rules && config.rules.length > 0) {
      const disabledRules = config.rules.filter(
        (r: UnifiedRule) => (r as unknown as { active?: boolean }).active === false || r.enabled === false,
      )
      if (disabledRules.length > 0) {
        score -= 5
        issues.push({
          severity: 'info',
          category: 'maintenance',
          message: `${disabledRules.length} disabled rule(s) found`,
          suggestion: 'Review and remove unused rules',
        })
      }
    }

    const grade = this.calculateGrade(score)
    const recommendations = this.generateRecommendations(config, issues)

    return {
      score: Math.max(0, score),
      grade,
      issues,
      recommendations,
    }
  }

  /**
   * Diff two arrays of items to determine what needs to be added, updated, or deleted
   * @param local - Local items
   * @param remote - Remote items
   * @param compareFn - Function to determine if two items are equal
   * @param idKey - Key to use for identifying items (default: 'id')
   */
  protected diffItems<T extends Record<string, unknown>>(
    local: T[],
    remote: T[],
    compareFn: CompareFn<T>,
    idKey: keyof T & string = 'id' as keyof T & string,
  ): DiffResult<T> {
    const toAdd: T[] = []
    const toUpdate: T[] = []
    const toDelete: T[] = []

    // Find items to add or update
    const getId = (obj: T) => obj[idKey] as unknown as string | number | undefined
    for (const localItem of local) {
      const remoteItem = remote.find((r) => getId(r) === getId(localItem))

      if (!remoteItem) {
        // Item doesn't exist remotely, add it
        toAdd.push(localItem)
      } else if (!compareFn(localItem, remoteItem)) {
        // Item exists but is different, update it
        toUpdate.push(localItem)
      }
    }

    // Find items to delete
    for (const remoteItem of remote) {
      const localItem = local.find((l) => getId(l) === getId(remoteItem))
      if (!localItem) {
        toDelete.push(remoteItem)
      }
    }

    return { toAdd, toUpdate, toDelete }
  }

  /**
   * Validate rule count against provider limits
   */
  protected validateRuleCount(count: number, limit: number | undefined): void {
    if (limit && count > limit) {
      throw new Error(`Rule count (${count}) exceeds provider limit (${limit})`)
    }

    if (limit && count > limit * 0.9) {
      logger.warn(`Approaching rule limit: ${count}/${limit} rules`)
    }
  }

  /**
   * Update metadata in configuration
   */
  protected updateMetadata(config: UnifiedConfig, version?: number): UnifiedConfig {
    return {
      ...config,
      metadata: {
        ...config.metadata,
        version,
        updatedAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Calculate grade from score
   */
  private calculateGrade(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
    if (score >= 80) return 'excellent'
    if (score >= 60) return 'good'
    if (score >= 40) return 'fair'
    return 'poor'
  }

  /**
   * Generate recommendations based on issues
   */
  private generateRecommendations(config: UnifiedConfig, issues: HealthIssue[]): string[] {
    const recommendations: string[] = []

    // Add recommendations based on issues
    if (issues.some((i) => i.category === 'rules')) {
      recommendations.push('Consider using predefined templates to get started')
    }

    if (issues.some((i) => i.category === 'maintainability')) {
      recommendations.push('Add descriptions to all rules for better documentation')
    }

    if (issues.some((i) => i.category === 'maintenance')) {
      recommendations.push('Remove or enable disabled rules to keep configuration clean')
    }

    return recommendations
  }

  /**
   * Log sync statistics
   */
  protected logSyncStats(result: SyncResult): void {
    logger.info(`Sync complete for ${this.name}:`)
    logger.info(`  Rules added: ${result.rulesAdded}`)
    logger.info(`  Rules updated: ${result.rulesUpdated}`)
    logger.info(`  Rules deleted: ${result.rulesDeleted}`)

    if (result.ipsAdded !== undefined) {
      logger.info(`  IPs added: ${result.ipsAdded}`)
      logger.info(`  IPs updated: ${result.ipsUpdated}`)
      logger.info(`  IPs deleted: ${result.ipsDeleted}`)
    }

    if (result.version) {
      logger.info(`  New version: ${result.version}`)
    }
  }
}
