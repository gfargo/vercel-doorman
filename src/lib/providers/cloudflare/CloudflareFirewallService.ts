import { BaseFirewallService } from '../BaseFirewallService'
import { CloudflareClient } from './CloudflareClient'
import { RuleTranslator } from '../../translators/RuleTranslator'
import { logger } from '../../logger'
import type { ProviderType, SyncOptions, SyncResult, ChangeSet, FeatureSet, HealthScore } from '../IFirewallProvider'
import type { UnifiedConfig, UnifiedRule, UnifiedIPRule } from '../../types/unified'
import type { CloudflareRule, CloudflareRuleset } from '../../types/cloudflare'

/**
 * Cloudflare Firewall Service
 * Implements IFirewallProvider for Cloudflare WAF
 */
export class CloudflareFirewallService extends BaseFirewallService {
  public readonly name: ProviderType = 'cloudflare'
  private client: CloudflareClient
  private currentRuleset?: CloudflareRuleset

  constructor(apiToken: string, zoneId: string, accountId?: string) {
    super()
    this.client = new CloudflareClient(apiToken, zoneId, accountId)
  }

  /**
   * Fetch current configuration from Cloudflare
   */
  public async fetchConfig(version?: number): Promise<UnifiedConfig> {
    logger.info('Fetching configuration from Cloudflare')

    // Get or create custom firewall ruleset
    const ruleset = await this.client.getOrCreateFirewallRuleset()
    this.currentRuleset = ruleset

    // Convert Cloudflare rules to unified format
    const rules: UnifiedRule[] = []
    const ips: UnifiedIPRule[] = []
    const translationWarnings: string[] = []

    for (const rule of ruleset.rules) {
      // Check if it's an IP blocking rule (simple ip.src eq expression)
      if (this.isIPBlockingRule(rule)) {
        const ipRule = this.cloudflareRuleToIPRule(rule)
        ips.push(ipRule)
      } else {
        const translation = RuleTranslator.cloudflareToUnified(rule)
        rules.push(translation.result)

        if (translation.warnings.length > 0) {
          translation.warnings.forEach((w) => translationWarnings.push(w.message))
        }
      }
    }

    if (translationWarnings.length > 0) {
      logger.warn(`Translation warnings: ${translationWarnings.join('; ')}`)
    }

    return {
      version: '2.0',
      provider: 'cloudflare',
      providers: {
        cloudflare: {
          zoneId: this.client['zoneId'],
          accountId: this.client['accountId'],
        },
      },
      rules,
      ips,
      metadata: {
        version: parseInt(ruleset.version, 10),
        updatedAt: ruleset.last_updated,
      },
    }
  }

  /**
   * Sync local configuration to Cloudflare
   */
  public async syncRules(config: UnifiedConfig, options?: SyncOptions): Promise<SyncResult> {
    logger.info(`Syncing ${config.rules.length} rules to Cloudflare${options?.dryRun ? ' (dry run)' : ''}`)

    if (options?.dryRun) {
      const changes = await this.getChanges(config)
      return {
        success: true,
        rulesAdded: changes.rulesToAdd.length,
        rulesUpdated: changes.rulesToUpdate.length,
        rulesDeleted: changes.rulesToDelete.length,
        ipsAdded: changes.ipsToAdd?.length || 0,
        ipsUpdated: changes.ipsToUpdate?.length || 0,
        ipsDeleted: changes.ipsToDelete?.length || 0,
      }
    }

    // Get or create ruleset
    const ruleset = await this.client.getOrCreateFirewallRuleset()
    this.currentRuleset = ruleset

    // Translate all rules to Cloudflare format
    const cloudflareRules: CloudflareRule[] = []

    // Add regular rules
    for (const rule of config.rules) {
      const translation = RuleTranslator.unifiedToCloudflare(rule)
      cloudflareRules.push(translation.result)

      if (translation.warnings.length > 0) {
        translation.warnings.forEach((w) => logger.warn(w.message))
      }
    }

    // Add IP blocking rules
    if (config.ips) {
      for (const ip of config.ips) {
        const cloudflareRule = RuleTranslator.unifiedIPToCloudflare(ip)
        cloudflareRules.push(cloudflareRule)
      }
    }

    // Update entire ruleset with new rules
    const updatedRuleset = await this.client.updateRuleset(ruleset.id, {
      rules: cloudflareRules,
    })

    const result: SyncResult = {
      success: true,
      rulesAdded: config.rules.length,
      rulesUpdated: 0,
      rulesDeleted: 0,
      ipsAdded: config.ips?.length || 0,
      ipsUpdated: 0,
      ipsDeleted: 0,
      version: parseInt(updatedRuleset.version, 10),
    }

    this.logSyncStats(result)
    return result
  }

  /**
   * Get changes between local and remote configurations
   */
  public async getChanges(config: UnifiedConfig): Promise<ChangeSet> {
    const remoteConfig = await this.fetchConfig()

    // Compare rules
    const ruleDiff = this.diffItems<UnifiedRule>(
      config.rules,
      remoteConfig.rules,
      (a, b) => a.id === b.id && JSON.stringify(a) === JSON.stringify(b),
      'id',
    )

    // Compare IPs
    let ipDiff = { toAdd: [], toUpdate: [], toDelete: [] }
    if (config.ips && remoteConfig.ips) {
      ipDiff = this.diffItems<UnifiedIPRule>(
        config.ips,
        remoteConfig.ips,
        (a, b) => a.ip === b.ip && a.action === b.action,
        'ip',
      )
    }

    return {
      rulesToAdd: ruleDiff.toAdd,
      rulesToUpdate: ruleDiff.toUpdate,
      rulesToDelete: ruleDiff.toDelete,
      ipsToAdd: ipDiff.toAdd,
      ipsToUpdate: ipDiff.toUpdate,
      ipsToDelete: ipDiff.toDelete,
      hasChanges:
        ruleDiff.toAdd.length > 0 ||
        ruleDiff.toUpdate.length > 0 ||
        ruleDiff.toDelete.length > 0 ||
        ipDiff.toAdd.length > 0 ||
        ipDiff.toUpdate.length > 0 ||
        ipDiff.toDelete.length > 0,
    }
  }

  /**
   * Get supported features for Cloudflare
   */
  public getSupportedFeatures(): FeatureSet {
    return {
      supportsCustomRules: true,
      supportsIPBlocking: true,
      supportsRateLimiting: true,
      supportsManagedRules: true,
      supportsGeoBlocking: true,
      supportsRedirect: true,
      supportsChallenge: true,
      maxRules: 125, // Cloudflare Free: 5, Pro: 20, Business: 100, Enterprise: unlimited (we use 125 as reasonable default)
    }
  }

  /**
   * Get health score for configuration
   */
  public getHealthScore(config: UnifiedConfig): HealthScore {
    const baseScore = super.getHealthScore(config)

    // Cloudflare-specific health checks
    const issues = [...baseScore.issues]

    // Check rule count against limit
    const features = this.getSupportedFeatures()
    if (features.maxRules && config.rules.length > features.maxRules * 0.8) {
      issues.push({
        severity: 'warning',
        category: 'limits',
        message: `Approaching Cloudflare rule limit (${config.rules.length}/${features.maxRules})`,
        suggestion: 'Consider consolidating rules or upgrading plan',
      })
    }

    return {
      ...baseScore,
      issues,
    }
  }

  /**
   * Verify Cloudflare credentials
   */
  public async verifyCredentials(): Promise<boolean> {
    return this.client.verifyCredentials()
  }

  /**
   * Check if a Cloudflare rule is a simple IP blocking rule
   */
  private isIPBlockingRule(rule: CloudflareRule): boolean {
    // Check if expression is simple IP equality
    return /^ip\.src eq [\d.]+$/.test(rule.expression.trim())
  }

  /**
   * Convert Cloudflare rule to IP rule
   */
  private cloudflareRuleToIPRule(rule: CloudflareRule): UnifiedIPRule {
    const match = rule.expression.match(/ip\.src eq ([\d.]+)/)
    const ip = match ? match[1] : ''

    // Extract hostname from description if present
    const hostnameMatch = rule.description?.match(/\(([^)]+)\)/)
    const hostname = hostnameMatch ? hostnameMatch[1] : undefined

    return {
      id: rule.id,
      ip,
      hostname,
      notes: rule.description,
      action: rule.action === 'allow' ? 'allow' : 'deny',
    }
  }
}
