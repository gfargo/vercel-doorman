import { CloudflareClient } from './CloudflareClient'
import { CloudflareValidator } from './CloudflareValidator'
import { logger } from '../../logger'
import type { UnifiedConfig } from '../../types/unified'

/**
 * Setup verification and health check functionality for Cloudflare
 */

export interface SetupVerificationResult {
  overall: 'healthy' | 'degraded' | 'unhealthy'
  checks: VerificationCheck[]
  features: FeatureAvailability
  recommendations: string[]
  summary: string
}

export interface VerificationCheck {
  name: string
  status: 'pass' | 'fail' | 'warning' | 'skip'
  message: string
  details?: string
  duration?: number
}

export interface FeatureAvailability {
  basicFirewallRules: boolean
  ipBlocking: boolean
  listsApi: boolean
  rateLimiting: boolean
  customResponses: boolean
  redirects: boolean
}

export interface SetupVerificationOptions {
  skipConnectivityTests?: boolean
  skipCredentialValidation?: boolean
  skipFeatureTests?: boolean
  timeout?: number
}

/**
 * Cloudflare setup verification service
 */
export class CloudflareSetupVerifier {
  private client?: CloudflareClient
  private validator?: CloudflareValidator

  constructor(
    private apiToken: string,
    private zoneId: string,
    private accountId?: string,
    private options: SetupVerificationOptions = {},
  ) {
    this.options = {
      skipConnectivityTests: false,
      skipCredentialValidation: false,
      skipFeatureTests: false,
      timeout: 30000, // 30 seconds
      ...options,
    }
  }

  /**
   * Run comprehensive setup verification
   */
  async verifySetup(): Promise<SetupVerificationResult> {
    const startTime = Date.now()
    const checks: VerificationCheck[] = []
    const features: FeatureAvailability = {
      basicFirewallRules: false,
      ipBlocking: false,
      listsApi: false,
      rateLimiting: false,
      customResponses: false,
      redirects: false,
    }

    logger.info('Starting Cloudflare setup verification...')

    try {
      // Initialize clients
      this.client = new CloudflareClient(this.apiToken, this.zoneId, this.accountId)
      this.validator = new CloudflareValidator(this.apiToken, this.zoneId, this.accountId)

      // 1. Basic connectivity test
      if (!this.options.skipConnectivityTests) {
        await this.checkConnectivity(checks)
      }

      // 2. Credential validation
      if (!this.options.skipCredentialValidation) {
        await this.checkCredentials(checks)
      }

      // 3. Zone access verification
      await this.checkZoneAccess(checks, features)

      // 4. Account access verification (if account ID provided)
      if (this.accountId) {
        await this.checkAccountAccess(checks, features)
      }

      // 5. Feature availability tests
      if (!this.options.skipFeatureTests) {
        await this.checkFeatureAvailability(checks, features)
      }

      // 6. Performance and limits check
      await this.checkLimitsAndPerformance(checks)
    } catch (error) {
      logger.error('Setup verification failed:', error)
      checks.push({
        name: 'Overall Verification',
        status: 'fail',
        message: 'Setup verification encountered an unexpected error',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      })
    }

    // Generate result
    const result = this.generateVerificationResult(checks, features)

    logger.info(`Setup verification completed in ${Date.now() - startTime}ms`)
    logger.info(`Overall status: ${result.overall}`)

    return result
  }

  /**
   * Test basic API connectivity
   */
  private async checkConnectivity(checks: VerificationCheck[]): Promise<void> {
    const startTime = Date.now()

    try {
      const connectivityResult = await this.validator!.testConnectivity()

      checks.push({
        name: 'API Connectivity',
        status: connectivityResult.valid ? 'pass' : 'fail',
        message: connectivityResult.valid
          ? 'Successfully connected to Cloudflare API'
          : 'Failed to connect to Cloudflare API',
        details: connectivityResult.suggestions.join('; ') || undefined,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      checks.push({
        name: 'API Connectivity',
        status: 'fail',
        message: 'Network connectivity test failed',
        details: error instanceof Error ? error.message : 'Unknown network error',
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Validate API credentials
   */
  private async checkCredentials(checks: VerificationCheck[]): Promise<void> {
    const startTime = Date.now()

    try {
      const tokenResult = await this.validator!.validateApiToken()

      checks.push({
        name: 'API Token Validation',
        status: tokenResult.valid ? 'pass' : 'fail',
        message: tokenResult.valid ? 'API token is valid and has required permissions' : 'API token validation failed',
        details: tokenResult.suggestions.join('; ') || undefined,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      checks.push({
        name: 'API Token Validation',
        status: 'fail',
        message: 'Unable to validate API token',
        details: error instanceof Error ? error.message : 'Token validation error',
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Check zone access and permissions
   */
  private async checkZoneAccess(checks: VerificationCheck[], features: FeatureAvailability): Promise<void> {
    const startTime = Date.now()

    try {
      const zoneResult = await this.validator!.validateZoneAccess(this.zoneId, this.apiToken)

      if (zoneResult.valid) {
        features.basicFirewallRules = true
        features.ipBlocking = true
        features.rateLimiting = true
        features.customResponses = true
        features.redirects = true
      }

      checks.push({
        name: 'Zone Access',
        status: zoneResult.valid ? 'pass' : 'fail',
        message: zoneResult.valid ? 'Zone access verified - firewall features available' : 'Zone access failed',
        details: zoneResult.suggestions.join('; ') || undefined,
        duration: Date.now() - startTime,
      })

      // Test zone details retrieval
      if (zoneResult.valid) {
        try {
          const zoneInfo = await this.client!.getZoneInfo()
          checks.push({
            name: 'Zone Information',
            status: 'pass',
            message: `Zone "${zoneInfo.name}" (${zoneInfo.status}) accessed successfully`,
            details: `Plan: ${zoneInfo.plan?.name || 'Unknown'}`,
            duration: Date.now() - startTime,
          })
        } catch (error) {
          checks.push({
            name: 'Zone Information',
            status: 'warning',
            message: 'Zone access works but unable to retrieve zone details',
            details: error instanceof Error ? error.message : 'Zone info error',
            duration: Date.now() - startTime,
          })
        }
      }
    } catch (error) {
      checks.push({
        name: 'Zone Access',
        status: 'fail',
        message: 'Zone access verification failed',
        details: error instanceof Error ? error.message : 'Zone access error',
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Check account access and Lists API availability
   */
  private async checkAccountAccess(checks: VerificationCheck[], features: FeatureAvailability): Promise<void> {
    const startTime = Date.now()

    try {
      const accountResult = await this.validator!.validateAccountAccess(this.accountId!, this.apiToken)

      checks.push({
        name: 'Account Access',
        status: accountResult.valid ? 'pass' : 'warning',
        message: accountResult.valid ? 'Account access verified' : 'Account access limited or unavailable',
        details: accountResult.suggestions.join('; ') || undefined,
        duration: Date.now() - startTime,
      })

      // Test Lists API availability
      if (accountResult.valid) {
        try {
          const listsResult = await this.validator!.validateListsApiAvailability()
          features.listsApi = listsResult.valid

          checks.push({
            name: 'Lists API',
            status: listsResult.valid ? 'pass' : 'warning',
            message: listsResult.valid
              ? 'Lists API available for bulk IP management'
              : 'Lists API not available - will use individual IP rules',
            details: listsResult.suggestions.join('; ') || undefined,
            duration: Date.now() - startTime,
          })
        } catch (error) {
          checks.push({
            name: 'Lists API',
            status: 'warning',
            message: 'Unable to verify Lists API availability',
            details: 'IP rules will be created individually',
            duration: Date.now() - startTime,
          })
        }
      }
    } catch (error) {
      checks.push({
        name: 'Account Access',
        status: 'warning',
        message: 'Account access verification failed',
        details: 'Lists API will not be available',
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Test feature availability
   */
  private async checkFeatureAvailability(checks: VerificationCheck[], _features: FeatureAvailability): Promise<void> {
    const startTime = Date.now()

    try {
      // Test ruleset access
      const rulesets = await this.client!.getRulesets()

      checks.push({
        name: 'Ruleset Access',
        status: 'pass',
        message: `Found ${rulesets.length} existing rulesets`,
        details: rulesets.length > 0 ? `Phases: ${rulesets.map((r) => r.phase).join(', ')}` : 'No existing rulesets',
        duration: Date.now() - startTime,
      })

      // Test if we can create/modify rules (dry run check)
      const customRulesets = rulesets.filter((r) => r.kind === 'custom')
      if (customRulesets.length > 0) {
        checks.push({
          name: 'Rule Management',
          status: 'pass',
          message: 'Custom rulesets available for rule management',
          details: `${customRulesets.length} custom ruleset(s) found`,
          duration: Date.now() - startTime,
        })
      } else {
        checks.push({
          name: 'Rule Management',
          status: 'warning',
          message: 'No custom rulesets found',
          details: 'New rulesets will be created as needed',
          duration: Date.now() - startTime,
        })
      }
    } catch (error) {
      checks.push({
        name: 'Feature Availability',
        status: 'fail',
        message: 'Unable to test feature availability',
        details: error instanceof Error ? error.message : 'Feature test error',
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Check API limits and performance
   */
  private async checkLimitsAndPerformance(checks: VerificationCheck[]): Promise<void> {
    const startTime = Date.now()

    try {
      // Test API response time with a simple call
      const perfStartTime = Date.now()
      await this.client!.getZoneInfo()
      const responseTime = Date.now() - perfStartTime

      let status: 'pass' | 'warning' | 'fail' = 'pass'
      let message = `API response time: ${responseTime}ms`

      if (responseTime > 5000) {
        status = 'fail'
        message += ' (Very slow - may impact operations)'
      } else if (responseTime > 2000) {
        status = 'warning'
        message += ' (Slow - operations may take longer)'
      } else {
        message += ' (Good performance)'
      }

      checks.push({
        name: 'API Performance',
        status,
        message,
        details: responseTime > 2000 ? 'Consider checking network connectivity' : undefined,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      checks.push({
        name: 'API Performance',
        status: 'warning',
        message: 'Unable to test API performance',
        details: error instanceof Error ? error.message : 'Performance test error',
        duration: Date.now() - startTime,
      })
    }
  }

  /**
   * Generate final verification result
   */
  private generateVerificationResult(
    checks: VerificationCheck[],
    features: FeatureAvailability,
  ): SetupVerificationResult {
    const failedChecks = checks.filter((c) => c.status === 'fail')
    const warningChecks = checks.filter((c) => c.status === 'warning')
    const passedChecks = checks.filter((c) => c.status === 'pass')

    let overall: 'healthy' | 'degraded' | 'unhealthy'
    let summary: string
    const recommendations: string[] = []

    // Determine overall status - account access failures should be warnings, not failures
    const criticalFailures = failedChecks.filter((c) => !c.name.includes('Account') && !c.name.includes('Lists API'))

    if (criticalFailures.length === 0) {
      if (warningChecks.length === 0 && failedChecks.length === 0) {
        overall = 'healthy'
        summary = `All ${passedChecks.length} checks passed. Cloudflare setup is fully functional.`
      } else {
        overall = 'degraded'
        const totalIssues = warningChecks.length + failedChecks.length
        summary = `${passedChecks.length} checks passed, ${totalIssues} warnings. Setup is functional with some limitations.`
      }
    } else {
      overall = 'unhealthy'
      summary = `${criticalFailures.length} critical checks failed, ${warningChecks.length} warnings, ${passedChecks.length} passed. Setup requires attention.`
    }

    // Generate recommendations
    if (!features.listsApi && this.accountId) {
      recommendations.push('Lists API is not available. Verify account ID and permissions for better IP management.')
    }

    if (!features.basicFirewallRules) {
      recommendations.push(
        'Basic firewall functionality is not available. Check zone access and API token permissions.',
      )
    }

    if (failedChecks.some((c) => c.name.includes('Connectivity'))) {
      recommendations.push('Network connectivity issues detected. Check internet connection and firewall settings.')
    }

    if (warningChecks.some((c) => c.name.includes('Performance'))) {
      recommendations.push('API performance is slow. Consider checking network conditions or trying again later.')
    }

    if (failedChecks.length === 0 && warningChecks.length === 0) {
      recommendations.push('Setup is healthy! You can proceed with syncing your firewall rules.')
    }

    return {
      overall,
      checks,
      features,
      recommendations,
      summary,
    }
  }

  /**
   * Create setup verifier from config
   */
  static fromConfig(config: UnifiedConfig, options?: SetupVerificationOptions): CloudflareSetupVerifier {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    const zoneId = config.providers?.cloudflare?.zoneId || process.env.CLOUDFLARE_ZONE_ID
    const accountId = config.providers?.cloudflare?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID

    if (!apiToken) {
      throw new Error('CLOUDFLARE_API_TOKEN environment variable is required')
    }

    if (!zoneId) {
      throw new Error('Zone ID is required (set in config or CLOUDFLARE_ZONE_ID environment variable)')
    }

    return new CloudflareSetupVerifier(apiToken, zoneId, accountId, options)
  }

  /**
   * Format verification results for display
   */
  static formatVerificationResults(result: SetupVerificationResult): string {
    const lines: string[] = []

    // Overall status
    const statusEmoji = result.overall === 'healthy' ? '✅' : result.overall === 'degraded' ? '⚠️' : '❌'
    lines.push(`${statusEmoji} ${result.summary}`)
    lines.push('')

    // Feature availability
    lines.push('🔧 Feature Availability:')
    const featureStatus = (available: boolean) => (available ? '✅' : '❌')
    lines.push(`  ${featureStatus(result.features.basicFirewallRules)} Basic Firewall Rules`)
    lines.push(`  ${featureStatus(result.features.ipBlocking)} IP Blocking`)
    lines.push(`  ${featureStatus(result.features.listsApi)} Lists API (Bulk IP Management)`)
    lines.push(`  ${featureStatus(result.features.rateLimiting)} Rate Limiting`)
    lines.push(`  ${featureStatus(result.features.customResponses)} Custom Responses`)
    lines.push(`  ${featureStatus(result.features.redirects)} Redirects`)
    lines.push('')

    // Detailed check results
    lines.push('🔍 Detailed Results:')
    for (const check of result.checks) {
      const statusEmoji =
        check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : check.status === 'fail' ? '❌' : '⏭️'
      const duration = check.duration ? ` (${check.duration}ms)` : ''
      lines.push(`  ${statusEmoji} ${check.name}: ${check.message}${duration}`)
      if (check.details) {
        lines.push(`     ${check.details}`)
      }
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('')
      lines.push('💡 Recommendations:')
      for (const recommendation of result.recommendations) {
        lines.push(`  • ${recommendation}`)
      }
    }

    return lines.join('\n')
  }
}
