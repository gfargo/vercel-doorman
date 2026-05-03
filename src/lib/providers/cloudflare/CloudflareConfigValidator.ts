import { z } from 'zod'
import type { UnifiedConfig } from '../../types/unified'
import { CloudflareValidator } from './CloudflareValidator'
import { logger } from '../../logger'

/**
 * Cloudflare-specific configuration validation
 */

export interface CloudflareValidationError {
  field: string
  message: string
  suggestion: string
  docsUrl?: string
  severity: 'error' | 'warning' | 'info'
}

export interface CloudflareValidationResult {
  valid: boolean
  errors: CloudflareValidationError[]
  warnings: CloudflareValidationError[]
  suggestions: string[]
  environmentVariables: {
    detected: string[]
    missing: string[]
    conflicts: string[]
  }
}

export interface CloudflareConfigValidationOptions {
  validateCredentials?: boolean
  checkEnvironmentVariables?: boolean
  validateConnectivity?: boolean
}

/**
 * Enhanced Cloudflare configuration validator
 */
export class CloudflareConfigValidator {
  private static readonly REQUIRED_ENV_VARS = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ZONE_ID']
  private static readonly OPTIONAL_ENV_VARS = ['CLOUDFLARE_ACCOUNT_ID']
  private static readonly ALL_ENV_VARS = [
    ...CloudflareConfigValidator.REQUIRED_ENV_VARS,
    ...CloudflareConfigValidator.OPTIONAL_ENV_VARS,
  ]

  private cloudflareValidator?: CloudflareValidator

  constructor(private options: CloudflareConfigValidationOptions = {}) {
    this.options = {
      validateCredentials: true,
      checkEnvironmentVariables: true,
      validateConnectivity: false,
      ...options,
    }
  }

  /**
   * Validate Cloudflare configuration comprehensively
   */
  async validateConfig(config: UnifiedConfig): Promise<CloudflareValidationResult> {
    const result: CloudflareValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
      environmentVariables: {
        detected: [],
        missing: [],
        conflicts: [],
      },
    }

    // Only validate if provider is Cloudflare
    if (config.provider !== 'cloudflare') {
      return result
    }

    // 1. Validate basic configuration structure
    this.validateConfigStructure(config, result)

    // 2. Check environment variables
    if (this.options.checkEnvironmentVariables) {
      this.validateEnvironmentVariables(config, result)
    }

    // 3. Validate Cloudflare-specific fields
    this.validateCloudflareFields(config, result)

    // 4. Check for configuration conflicts
    this.validateConfigurationConflicts(config, result)

    // 5. Validate credentials if requested
    if (this.options.validateCredentials) {
      await this.validateCredentials(config, result)
    }

    // 6. Validate connectivity if requested
    if (this.options.validateConnectivity) {
      await this.validateConnectivity(config, result)
    }

    // 7. Generate actionable suggestions
    this.generateSuggestions(config, result)

    // Set overall validity
    result.valid = result.errors.length === 0

    return result
  }

  /**
   * Validate basic configuration structure
   */
  private validateConfigStructure(config: UnifiedConfig, result: CloudflareValidationResult): void {
    // Check if providers section exists
    if (!config.providers) {
      result.errors.push({
        field: 'providers',
        message: 'Missing providers configuration section',
        suggestion: 'Add a "providers" section to your configuration with Cloudflare settings',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#configuration',
        severity: 'error',
      })
      return
    }

    // Check if Cloudflare provider config exists
    if (!config.providers.cloudflare) {
      result.errors.push({
        field: 'providers.cloudflare',
        message: 'Missing Cloudflare provider configuration',
        suggestion: 'Add a "cloudflare" section under "providers" with zoneId and optionally accountId',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#configuration',
        severity: 'error',
      })
      return
    }

    // Validate Cloudflare config schema
    const cloudflareConfigSchema = z.object({
      zoneId: z.string().min(1, 'Zone ID cannot be empty').optional(),
      accountId: z.string().min(1, 'Account ID cannot be empty').optional(),
    })

    const validation = cloudflareConfigSchema.safeParse(config.providers.cloudflare)
    if (!validation.success) {
      for (const error of validation.error.errors) {
        result.errors.push({
          field: `providers.cloudflare.${error.path.join('.')}`,
          message: error.message,
          suggestion: 'Ensure the field contains a valid non-empty string',
          severity: 'error',
        })
      }
    }
  }

  /**
   * Validate environment variables
   */
  private validateEnvironmentVariables(config: UnifiedConfig, result: CloudflareValidationResult): void {
    const envVars = result.environmentVariables

    // Check which environment variables are present
    for (const envVar of CloudflareConfigValidator.ALL_ENV_VARS) {
      if (process.env[envVar]) {
        envVars.detected.push(envVar)
      }
    }

    // Check for missing required environment variables
    for (const envVar of CloudflareConfigValidator.REQUIRED_ENV_VARS) {
      if (!process.env[envVar]) {
        envVars.missing.push(envVar)
      }
    }

    // Check for conflicts between config file and environment variables
    const cloudflareConfig = config.providers?.cloudflare
    if (cloudflareConfig) {
      // Zone ID conflict
      if (cloudflareConfig.zoneId && process.env.CLOUDFLARE_ZONE_ID) {
        envVars.conflicts.push('CLOUDFLARE_ZONE_ID')
        result.warnings.push({
          field: 'providers.cloudflare.zoneId',
          message: 'Zone ID specified in both config file and environment variable',
          suggestion: 'Environment variable takes precedence. Remove from config file or unset environment variable',
          severity: 'warning',
        })
      }

      // Account ID conflict
      if (cloudflareConfig.accountId && process.env.CLOUDFLARE_ACCOUNT_ID) {
        envVars.conflicts.push('CLOUDFLARE_ACCOUNT_ID')
        result.warnings.push({
          field: 'providers.cloudflare.accountId',
          message: 'Account ID specified in both config file and environment variable',
          suggestion: 'Environment variable takes precedence. Remove from config file or unset environment variable',
          severity: 'warning',
        })
      }
    }

    // Add errors for missing required environment variables
    if (envVars.missing.includes('CLOUDFLARE_API_TOKEN')) {
      result.errors.push({
        field: 'environment.CLOUDFLARE_API_TOKEN',
        message: 'Cloudflare API token is required but not found',
        suggestion: 'Set CLOUDFLARE_API_TOKEN environment variable with your Cloudflare API token',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#api-token',
        severity: 'error',
      })
    }

    // Check for zone ID (either in config or environment)
    const hasZoneId = cloudflareConfig?.zoneId || process.env.CLOUDFLARE_ZONE_ID
    if (!hasZoneId) {
      result.errors.push({
        field: 'providers.cloudflare.zoneId',
        message: 'Cloudflare Zone ID is required but not found',
        suggestion: 'Set CLOUDFLARE_ZONE_ID environment variable or add zoneId to providers.cloudflare in config',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#zone-id',
        severity: 'error',
      })
    }

    // Add info about optional account ID
    const hasAccountId = cloudflareConfig?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID
    if (!hasAccountId) {
      result.warnings.push({
        field: 'providers.cloudflare.accountId',
        message: 'Account ID not provided - Lists API will not be available',
        suggestion: 'Set CLOUDFLARE_ACCOUNT_ID environment variable or add accountId to config to enable bulk IP management',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#account-id',
        severity: 'info',
      })
    }
  }

  /**
   * Validate Cloudflare-specific fields
   */
  private validateCloudflareFields(config: UnifiedConfig, result: CloudflareValidationResult): void {
    const cloudflareConfig = config.providers?.cloudflare
    if (!cloudflareConfig) return

    // Validate Zone ID format (basic check)
    const zoneId = cloudflareConfig.zoneId || process.env.CLOUDFLARE_ZONE_ID
    if (zoneId && !this.isValidZoneIdFormat(zoneId)) {
      result.errors.push({
        field: 'providers.cloudflare.zoneId',
        message: 'Zone ID format appears invalid',
        suggestion: 'Zone ID should be a 32-character hexadecimal string. Check your Cloudflare dashboard',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#finding-zone-id',
        severity: 'error',
      })
    }

    // Validate Account ID format (basic check)
    const accountId = cloudflareConfig.accountId || process.env.CLOUDFLARE_ACCOUNT_ID
    if (accountId && !this.isValidAccountIdFormat(accountId)) {
      result.errors.push({
        field: 'providers.cloudflare.accountId',
        message: 'Account ID format appears invalid',
        suggestion: 'Account ID should be a 32-character hexadecimal string. Check your Cloudflare dashboard',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#finding-account-id',
        severity: 'error',
      })
    }

    // Validate API token format (basic check)
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    if (apiToken && !this.isValidApiTokenFormat(apiToken)) {
      result.warnings.push({
        field: 'environment.CLOUDFLARE_API_TOKEN',
        message: 'API token format appears unusual',
        suggestion: 'Cloudflare API tokens typically start with a specific prefix. Verify your token is correct',
        docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#api-token',
        severity: 'warning',
      })
    }
  }

  /**
   * Check for configuration conflicts and precedence issues
   */
  private validateConfigurationConflicts(config: UnifiedConfig, result: CloudflareValidationResult): void {
    // Check if rules are compatible with Cloudflare
    if (config.rules && config.rules.length > 0) {
      for (const rule of config.rules) {
        // Check for unsupported conditions
        for (const condition of rule.conditions) {
          if (!this.isConditionSupportedByCloudflare(condition.field)) {
            result.warnings.push({
              field: `rules.${rule.name}.conditions`,
              message: `Condition field "${condition.field}" may have limited support in Cloudflare`,
              suggestion: 'Review Cloudflare WAF documentation for supported fields and consider alternative approaches',
              docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/limitations',
              severity: 'warning',
            })
          }
        }

        // Check for unsupported actions
        if (!this.isActionSupportedByCloudflare(rule.action.type)) {
          result.warnings.push({
            field: `rules.${rule.name}.action`,
            message: `Action type "${rule.action.type}" may not be fully supported in Cloudflare`,
            suggestion: 'Review Cloudflare WAF documentation for supported actions',
            docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/limitations',
            severity: 'warning',
          })
        }
      }
    }
  }

  /**
   * Validate credentials by making API calls
   */
  private async validateCredentials(config: UnifiedConfig, result: CloudflareValidationResult): Promise<void> {
    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    const zoneId = config.providers?.cloudflare?.zoneId || process.env.CLOUDFLARE_ZONE_ID
    const accountId = config.providers?.cloudflare?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID

    if (!apiToken || !zoneId) {
      // Skip credential validation if basic requirements aren't met
      return
    }

    try {
      this.cloudflareValidator = new CloudflareValidator(apiToken, zoneId, accountId)

      // Validate API token
      const tokenValidation = await this.cloudflareValidator.validateApiToken()
      if (!tokenValidation.valid) {
        result.errors.push({
          field: 'environment.CLOUDFLARE_API_TOKEN',
          message: 'API token validation failed',
          suggestion: tokenValidation.suggestions.join('; ') || 'Verify your API token has the correct permissions',
          docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#api-token',
          severity: 'error',
        })
      }

      // Validate zone access
      const zoneValidation = await this.cloudflareValidator.validateZoneAccess(zoneId, apiToken)
      if (!zoneValidation.valid) {
        result.errors.push({
          field: 'providers.cloudflare.zoneId',
          message: 'Zone access validation failed',
          suggestion: zoneValidation.suggestions.join('; ') || 'Verify the Zone ID is correct and your token has zone access',
          docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#zone-id',
          severity: 'error',
        })
      }

      // Validate account access if account ID is provided
      if (accountId) {
        const accountValidation = await this.cloudflareValidator.validateAccountAccess(accountId, apiToken)
        if (!accountValidation.valid) {
          result.warnings.push({
            field: 'providers.cloudflare.accountId',
            message: 'Account access validation failed',
            suggestion: accountValidation.suggestions.join('; ') || 'Lists API will not be available. Verify Account ID and permissions',
            docsUrl: 'https://docs.doorman.griffen.codes/cloudflare/setup#account-id',
            severity: 'warning',
          })
        }
      }
    } catch (error) {
      logger.debug('Credential validation error:', error)
      result.warnings.push({
        field: 'credentials',
        message: 'Unable to validate credentials due to network or API error',
        suggestion: 'Check your internet connection and try again later',
        severity: 'warning',
      })
    }
  }

  /**
   * Validate connectivity without making configuration changes
   */
  private async validateConnectivity(config: UnifiedConfig, result: CloudflareValidationResult): Promise<void> {
    if (!this.cloudflareValidator) {
      return // Skip if validator not initialized
    }

    try {
      // Test basic API connectivity
      const connectivityTest = await this.cloudflareValidator.testConnectivity()
      if (!connectivityTest.valid) {
        result.errors.push({
          field: 'connectivity',
          message: 'Failed to connect to Cloudflare API',
          suggestion: 'Check your internet connection and Cloudflare API status',
          severity: 'error',
        })
      }

      // Test Lists API availability if account ID is provided
      const accountId = config.providers?.cloudflare?.accountId || process.env.CLOUDFLARE_ACCOUNT_ID
      if (accountId) {
        const listsAvailability = await this.cloudflareValidator.validateListsApiAvailability()
        if (!listsAvailability.valid) {
          result.warnings.push({
            field: 'features.lists',
            message: 'Lists API is not available',
            suggestion: 'IP rules will be created individually instead of using Lists. This may impact performance with many IPs',
            severity: 'info',
          })
        }
      }
    } catch (error) {
      logger.debug('Connectivity validation error:', error)
      result.warnings.push({
        field: 'connectivity',
        message: 'Unable to test connectivity',
        suggestion: 'Manual verification may be required',
        severity: 'warning',
      })
    }
  }

  /**
   * Generate actionable suggestions based on validation results
   */
  private generateSuggestions(config: UnifiedConfig, result: CloudflareValidationResult): void {
    const suggestions: string[] = []

    // Environment variable suggestions
    if (result.environmentVariables.missing.length > 0) {
      suggestions.push(
        `Set missing environment variables: ${result.environmentVariables.missing.join(', ')}`,
      )
    }

    if (result.environmentVariables.conflicts.length > 0) {
      suggestions.push(
        'Resolve configuration conflicts by choosing either config file or environment variables for credentials',
      )
    }

    // Configuration suggestions
    if (!config.providers?.cloudflare?.accountId && !process.env.CLOUDFLARE_ACCOUNT_ID) {
      suggestions.push(
        'Consider adding Account ID to enable Lists API for better IP management performance',
      )
    }

    // Rule optimization suggestions
    if (config.rules && config.rules.length > 10) {
      suggestions.push(
        'Consider grouping similar rules or using Lists for IP-based rules to improve performance',
      )
    }

    // Add suggestions for common improvements
    if (result.errors.length === 0 && result.warnings.length === 0) {
      suggestions.push('Configuration looks good! Run a connectivity test to verify everything works')
    }

    result.suggestions = suggestions
  }

  /**
   * Format validation results for display
   */
  static formatValidationResults(result: CloudflareValidationResult): string {
    const lines: string[] = []

    if (result.valid) {
      lines.push('✅ Cloudflare configuration is valid')
    } else {
      lines.push('❌ Cloudflare configuration has errors')
    }

    // Add errors
    if (result.errors.length > 0) {
      lines.push('\n🚨 Errors:')
      for (const error of result.errors) {
        lines.push(`  • ${error.field}: ${error.message}`)
        lines.push(`    💡 ${error.suggestion}`)
        if (error.docsUrl) {
          lines.push(`    📖 ${error.docsUrl}`)
        }
      }
    }

    // Add warnings
    if (result.warnings.length > 0) {
      lines.push('\n⚠️  Warnings:')
      for (const warning of result.warnings) {
        lines.push(`  • ${warning.field}: ${warning.message}`)
        lines.push(`    💡 ${warning.suggestion}`)
        if (warning.docsUrl) {
          lines.push(`    📖 ${warning.docsUrl}`)
        }
      }
    }

    // Add environment variable summary
    if (result.environmentVariables.detected.length > 0 || result.environmentVariables.missing.length > 0) {
      lines.push('\n🌍 Environment Variables:')
      if (result.environmentVariables.detected.length > 0) {
        lines.push(`  ✅ Found: ${result.environmentVariables.detected.join(', ')}`)
      }
      if (result.environmentVariables.missing.length > 0) {
        lines.push(`  ❌ Missing: ${result.environmentVariables.missing.join(', ')}`)
      }
      if (result.environmentVariables.conflicts.length > 0) {
        lines.push(`  ⚠️  Conflicts: ${result.environmentVariables.conflicts.join(', ')}`)
      }
    }

    // Add suggestions
    if (result.suggestions.length > 0) {
      lines.push('\n💡 Suggestions:')
      for (const suggestion of result.suggestions) {
        lines.push(`  • ${suggestion}`)
      }
    }

    return lines.join('\n')
  }

  // Helper methods for format validation
  private isValidZoneIdFormat(zoneId: string): boolean {
    // Cloudflare Zone IDs are 32-character hexadecimal strings
    return /^[a-f0-9]{32}$/i.test(zoneId)
  }

  private isValidAccountIdFormat(accountId: string): boolean {
    // Cloudflare Account IDs are 32-character hexadecimal strings
    return /^[a-f0-9]{32}$/i.test(accountId)
  }

  private isValidApiTokenFormat(token: string): boolean {
    // Basic check - Cloudflare API tokens are typically longer and contain specific patterns
    // This is a loose validation to catch obvious errors
    return token.length > 20 && !token.includes(' ')
  }

  private isConditionSupportedByCloudflare(field: string): boolean {
    // List of fields that are well-supported in Cloudflare WAF
    const supportedFields = [
      'ip',
      'country',
      'path',
      'host',
      'method',
      'header',
      'query',
      'user_agent',
      'referer',
      'scheme',
    ]
    return supportedFields.includes(field)
  }

  private isActionSupportedByCloudflare(actionType: string): boolean {
    // List of actions that are well-supported in Cloudflare WAF
    const supportedActions = ['block', 'challenge', 'allow', 'log', 'redirect']
    return supportedActions.includes(actionType)
  }
}