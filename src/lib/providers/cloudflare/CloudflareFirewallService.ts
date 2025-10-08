import { BaseFirewallService } from '../BaseFirewallService'
import { CloudflareClient } from './CloudflareClient'
import { RuleTranslator } from '../../translators/RuleTranslator'
import { logger } from '../../logger'
import type { ProviderType, SyncOptions, SyncResult, ChangeSet, FeatureSet, HealthScore } from '../IFirewallProvider'
import type { UnifiedConfig, UnifiedRule, UnifiedIPRule } from '../../types/unified'
import type { CloudflareRule } from '../../types/cloudflare'
// CloudflareRuleset imported for future caching use
// import type { CloudflareRuleset } from '../../types/cloudflare'

/**
 * Cloudflare Firewall Service
 * Implements IFirewallProvider for Cloudflare WAF
 */
export class CloudflareFirewallService extends BaseFirewallService {
  public readonly name: ProviderType = 'cloudflare'
  private client: CloudflareClient
  // Cached for potential future use
  // private _currentRuleset?: CloudflareRuleset
  // private _ipBlocklistId?: string
  private useListsForIPs: boolean

  constructor(apiToken: string, zoneId: string, accountId?: string) {
    super()
    this.client = new CloudflareClient(apiToken, zoneId, accountId)
    // Use Lists for IP blocking if accountId is provided
    this.useListsForIPs = !!accountId
  }

  /**
   * Fetch current configuration from Cloudflare
   */
  public async fetchConfig(_version?: number): Promise<UnifiedConfig> {
    logger.info('Fetching configuration from Cloudflare')

    // Get or create custom firewall ruleset
    const ruleset = await this.client.getOrCreateFirewallRuleset()
    // Cache for potential future use
    // this._currentRuleset = ruleset

    // Convert Cloudflare rules to unified format
    const rules: UnifiedRule[] = []
    const ips: UnifiedIPRule[] = []
    const translationWarnings: string[] = []

    for (const rule of ruleset.rules) {
      // Skip List-based IP rules (we'll fetch those separately)
      if (this.isListBasedIPRule(rule)) {
        continue
      }

      // Check if it's a simple IP blocking rule (individual IP rule)
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

    // Fetch IPs from List if using Lists
    if (this.useListsForIPs) {
      try {
        const ipList = await this.client.getOrCreateIPBlocklist()
        // Cache for potential future use
        // this._ipBlocklistId = ipList.id

        const listItems = await this.client.getListItems(ipList.id)
        for (const item of listItems) {
          if (item.ip) {
            ips.push({
              id: item.id,
              ip: item.ip,
              notes: item.comment,
              action: 'deny', // Lists are for blocking
            })
          }
        }

        logger.debug(`Fetched ${listItems.length} IPs from List`)
      } catch (error) {
        logger.warn(`Failed to fetch IPs from List: ${error instanceof Error ? error.message : String(error)}`)
        // Continue without List IPs
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
    // Cache for potential future use
    // this._currentRuleset = ruleset

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

    // Handle IP blocking
    let ipsAdded = 0
    const ipsUpdated = 0
    let ipsDeleted = 0

    if (this.useListsForIPs && config.ips && config.ips.length > 0) {
      // Use Lists for IP blocking
      try {
        const ipList = await this.client.getOrCreateIPBlocklist()
        // Cache for potential future use
        // this._ipBlocklistId = ipList.id

        // Get current IPs in list
        const currentItems = await this.client.getListItems(ipList.id)
        const currentIPs = new Set(currentItems.map((item) => item.ip))
        const desiredIPs = new Set(config.ips.map((ip) => ip.ip))

        // Add new IPs
        const ipsToAdd = config.ips.filter((ip) => !currentIPs.has(ip.ip))
        if (ipsToAdd.length > 0) {
          await this.client.addListItems(ipList.id, {
            items: ipsToAdd.map((ip) => ({
              ip: ip.ip,
              comment: ip.notes || ip.hostname || `Blocked by Doorman`,
            })),
          })
          ipsAdded = ipsToAdd.length
          logger.info(`Added ${ipsAdded} IPs to List`)
        }

        // Remove IPs no longer in config
        const ipsToRemove = currentItems.filter((item) => item.ip && !desiredIPs.has(item.ip))
        if (ipsToRemove.length > 0) {
          await this.client.removeListItems(ipList.id, {
            items: ipsToRemove.map((item) => ({ id: item.id! })),
          })
          ipsDeleted = ipsToRemove.length
          logger.info(`Removed ${ipsDeleted} IPs from List`)
        }

        // Add a rule to block IPs in the list (if not already present)
        const listRuleExpression = `ip.src in $${ipList.name.replace(/\s+/g, '_').toLowerCase()}`
        const hasListRule = ruleset.rules.some((r) => r.expression.includes('in $'))

        if (!hasListRule && config.ips.length > 0) {
          cloudflareRules.push({
            id: `rule_doorman_ip_list`,
            action: 'block',
            expression: listRuleExpression,
            description: 'Block IPs in Doorman IP Blocklist',
            enabled: true,
          })
        }
      } catch (error) {
        logger.warn(`Failed to sync IPs via List, falling back to individual rules: ${error}`)
        // Fall back to individual IP rules
        for (const ip of config.ips) {
          const cloudflareRule = RuleTranslator.unifiedIPToCloudflare(ip)
          cloudflareRules.push(cloudflareRule)
        }
        ipsAdded = config.ips.length
      }
    } else if (config.ips && config.ips.length > 0) {
      // Use individual IP rules (no accountId provided or Lists disabled)
      for (const ip of config.ips) {
        const cloudflareRule = RuleTranslator.unifiedIPToCloudflare(ip)
        cloudflareRules.push(cloudflareRule)
      }
      ipsAdded = config.ips.length
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
      ipsAdded,
      ipsUpdated,
      ipsDeleted,
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
    let ipDiff: import('../BaseFirewallService').DiffResult<UnifiedIPRule> = { toAdd: [], toUpdate: [], toDelete: [] }
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
   * Validate configuration with Cloudflare-specific rules
   */
  public validateConfig(config: UnifiedConfig): import('../IFirewallProvider').ValidationResult {
    const baseResult = super.validateConfig(config)
    const errors = [...baseResult.errors]
    const warnings = [...baseResult.warnings]

    // Cloudflare-specific validations
    if (config && config.rules) {
      // Check rule count against Cloudflare limits
      const features = this.getSupportedFeatures()
      if (features.maxRules && config.rules.length > features.maxRules) {
        errors.push({
          path: 'rules',
          message: `Rule count (${config.rules.length}) exceeds Cloudflare limit (${features.maxRules})`,
          code: 'CLOUDFLARE_RULE_LIMIT_EXCEEDED',
        })
      }

      // Validate each rule
      config.rules.forEach((rule, index) => {
        // Check for conditions (Cloudflare requires expressions)
        if (!rule.conditions || rule.conditions.length === 0) {
          errors.push({
            path: `rules[${index}]`,
            message: `Rule "${rule.name}" has no conditions`,
            code: 'CLOUDFLARE_RULE_NO_CONDITIONS',
          })
        }

        // Validate rate limiting configuration
        if (rule.action.type === 'rate_limit' && rule.action.rateLimit) {
          const rateLimit = rule.action.rateLimit

          // Check requests per period
          if (rateLimit.requests < 1) {
            errors.push({
              path: `rules[${index}].action.rateLimit.requests`,
              message: `Rate limit requests must be at least 1`,
              code: 'CLOUDFLARE_INVALID_RATE_LIMIT',
            })
          }

          // Check period format
          if (!rateLimit.window.match(/^\d+[smhd]$/)) {
            errors.push({
              path: `rules[${index}].action.rateLimit.window`,
              message: `Invalid window format: ${rateLimit.window}. Must be like "60s", "1h", "1d"`,
              code: 'CLOUDFLARE_INVALID_WINDOW_FORMAT',
            })
          }

          // Validate characteristics
          if (rateLimit.characteristics && rateLimit.characteristics.length === 0) {
            warnings.push({
              path: `rules[${index}].action.rateLimit.characteristics`,
              message: 'Empty characteristics array, defaulting to ["ip.src"]',
              code: 'CLOUDFLARE_EMPTY_CHARACTERISTICS',
            })
          }

          // Validate mitigation timeout
          if (rateLimit.mitigationTimeout !== undefined && rateLimit.mitigationTimeout < 60) {
            warnings.push({
              path: `rules[${index}].action.rateLimit.mitigationTimeout`,
              message: 'Mitigation timeout less than 60 seconds may not be effective',
              code: 'CLOUDFLARE_SHORT_MITIGATION_TIMEOUT',
            })
          }
        }

        // Validate redirect configuration
        if (rule.action.type === 'redirect' && rule.action.redirect) {
          const redirect = rule.action.redirect

          if (!redirect.location) {
            errors.push({
              path: `rules[${index}].action.redirect.location`,
              message: 'Redirect location is required',
              code: 'CLOUDFLARE_REDIRECT_NO_LOCATION',
            })
          } else {
            // Basic URL validation
            try {
              new URL(redirect.location)
            } catch {
              // Check if it's a relative path
              if (!redirect.location.startsWith('/')) {
                errors.push({
                  path: `rules[${index}].action.redirect.location`,
                  message: `Invalid redirect location: ${redirect.location}`,
                  code: 'CLOUDFLARE_INVALID_REDIRECT_URL',
                })
              }
            }
          }
        }
      })

      // Validate IP rules
      if (config.ips) {
        config.ips.forEach((ip, index) => {
          // Basic IP/CIDR validation
          if (!ip.ip.match(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/)) {
            errors.push({
              path: `ips[${index}].ip`,
              message: `Invalid IP address or CIDR: ${ip.ip}`,
              code: 'CLOUDFLARE_INVALID_IP',
            })
          }

          // Warn about large IP lists without accountId
          if (!this.useListsForIPs && config.ips && config.ips.length > 50) {
            warnings.push({
              path: 'ips',
              message: `Large IP list (${config.ips.length} IPs) detected. Consider providing accountId to use Cloudflare Lists for better performance`,
              code: 'CLOUDFLARE_LARGE_IP_LIST',
            })
          }
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
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
   * Check if a Cloudflare rule is a List-based IP blocking rule
   */
  private isListBasedIPRule(rule: CloudflareRule): boolean {
    // Check if expression uses List syntax (ip.src in $list_name)
    return /ip\.src in \$/.test(rule.expression.trim())
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
    const ip = match?.[1] || ''

    // Extract hostname from description if present
    const hostnameMatch = rule.description?.match(/\(([^)]+)\)/)
    const hostname = hostnameMatch?.[1]

    return {
      id: rule.id,
      ip,
      hostname,
      notes: rule.description,
      action: rule.action === 'allow' ? 'allow' : 'deny',
    }
  }
}
