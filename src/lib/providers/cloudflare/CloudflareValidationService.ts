import { CloudflareConfigValidator, type CloudflareValidationResult } from './CloudflareConfigValidator'
import { CloudflareSetupVerifier, type SetupVerificationResult } from './CloudflareSetupVerifier'
import type { UnifiedConfig } from '../../types/unified'
import { logger } from '../../logger'

/**
 * Comprehensive Cloudflare validation service
 * Combines configuration validation and setup verification
 */

export interface ComprehensiveValidationResult {
  configValidation: CloudflareValidationResult
  setupVerification?: SetupVerificationResult
  overall: 'healthy' | 'degraded' | 'unhealthy'
  summary: string
  recommendations: string[]
}

export interface ValidationOptions {
  validateCredentials?: boolean
  checkEnvironmentVariables?: boolean
  validateConnectivity?: boolean
  skipSetupVerification?: boolean
  timeout?: number
}

/**
 * Main validation service for Cloudflare configurations
 */
export class CloudflareValidationService {
  constructor(private options: ValidationOptions = {}) {
    this.options = {
      validateCredentials: true,
      checkEnvironmentVariables: true,
      validateConnectivity: false,
      skipSetupVerification: false,
      timeout: 30000,
      ...options,
    }
  }

  /**
   * Run comprehensive validation of Cloudflare configuration
   */
  async validateConfiguration(config: UnifiedConfig): Promise<ComprehensiveValidationResult> {
    logger.info('Starting comprehensive Cloudflare configuration validation...')

    // Step 1: Configuration validation
    const configValidator = new CloudflareConfigValidator({
      validateCredentials: this.options.validateCredentials,
      checkEnvironmentVariables: this.options.checkEnvironmentVariables,
      validateConnectivity: this.options.validateConnectivity,
    })

    const configValidation = await configValidator.validateConfig(config)

    // Step 2: Setup verification (if not skipped and basic config is valid)
    let setupVerification: SetupVerificationResult | undefined

    if (!this.options.skipSetupVerification && configValidation.valid) {
      try {
        const setupVerifier = CloudflareSetupVerifier.fromConfig(config, {
          skipConnectivityTests: !this.options.validateConnectivity,
          skipCredentialValidation: !this.options.validateCredentials,
          timeout: this.options.timeout,
        })

        setupVerification = await setupVerifier.verifySetup()
      } catch (error) {
        logger.warn('Setup verification failed:', error)
        // Don't fail the entire validation if setup verification fails
        setupVerification = {
          overall: 'unhealthy',
          checks: [{
            name: 'Setup Verification',
            status: 'fail',
            message: 'Setup verification could not be completed',
            details: error instanceof Error ? error.message : 'Unknown error',
          }],
          features: {
            basicFirewallRules: false,
            ipBlocking: false,
            listsApi: false,
            rateLimiting: false,
            customResponses: false,
            redirects: false,
          },
          recommendations: ['Fix configuration errors before running setup verification'],
          summary: 'Setup verification failed due to configuration issues',
        }
      }
    }

    // Step 3: Generate comprehensive result
    const result = this.generateComprehensiveResult(configValidation, setupVerification)

    logger.info(`Comprehensive validation completed: ${result.overall}`)
    return result
  }

  /**
   * Quick validation for basic configuration issues
   */
  async quickValidate(config: UnifiedConfig): Promise<CloudflareValidationResult> {
    const configValidator = new CloudflareConfigValidator({
      validateCredentials: false,
      checkEnvironmentVariables: true,
      validateConnectivity: false,
    })

    return configValidator.validateConfig(config)
  }

  /**
   * Validate only credentials without full setup verification
   */
  async validateCredentialsOnly(config: UnifiedConfig): Promise<CloudflareValidationResult> {
    const configValidator = new CloudflareConfigValidator({
      validateCredentials: true,
      checkEnvironmentVariables: true,
      validateConnectivity: false,
    })

    return configValidator.validateConfig(config)
  }

  /**
   * Run setup health check
   */
  async healthCheck(config: UnifiedConfig): Promise<SetupVerificationResult> {
    const setupVerifier = CloudflareSetupVerifier.fromConfig(config, {
      skipFeatureTests: false,
      timeout: this.options.timeout,
    })

    return setupVerifier.verifySetup()
  }

  /**
   * Generate comprehensive validation result
   */
  private generateComprehensiveResult(
    configValidation: CloudflareValidationResult,
    setupVerification?: SetupVerificationResult,
  ): ComprehensiveValidationResult {
    let overall: 'healthy' | 'degraded' | 'unhealthy'
    let summary: string
    const recommendations: string[] = []

    // Determine overall status
    if (!configValidation.valid) {
      overall = 'unhealthy'
      summary = 'Configuration validation failed - setup cannot proceed'
    } else if (setupVerification) {
      overall = setupVerification.overall
      if (setupVerification.overall === 'healthy') {
        summary = 'Configuration and setup are fully functional'
      } else if (setupVerification.overall === 'degraded') {
        summary = 'Configuration is valid but setup has some limitations'
      } else {
        summary = 'Configuration is valid but setup verification failed'
      }
    } else {
      overall = configValidation.warnings.length > 0 ? 'degraded' : 'healthy'
      summary = 'Configuration validation passed'
      if (!this.options.skipSetupVerification) {
        summary += ' - run with setup verification for complete validation'
      }
    }

    // Combine recommendations
    recommendations.push(...configValidation.suggestions)
    if (setupVerification) {
      recommendations.push(...setupVerification.recommendations)
    }

    // Add specific recommendations based on results
    if (configValidation.errors.length > 0) {
      recommendations.unshift('Fix configuration errors before proceeding with setup')
    }

    if (configValidation.environmentVariables.missing.length > 0) {
      recommendations.unshift('Set required environment variables for proper functionality')
    }

    if (setupVerification?.features && !setupVerification.features.listsApi) {
      recommendations.push('Consider enabling Lists API for better performance with large IP lists')
    }

    // Remove duplicates
    const uniqueRecommendations = [...new Set(recommendations)]

    return {
      configValidation,
      setupVerification,
      overall,
      summary,
      recommendations: uniqueRecommendations,
    }
  }

  /**
   * Format comprehensive validation results for display
   */
  static formatComprehensiveResults(result: ComprehensiveValidationResult): string {
    const lines: string[] = []

    // Overall status
    const statusEmoji = result.overall === 'healthy' ? '✅' : result.overall === 'degraded' ? '⚠️' : '❌'
    lines.push(`${statusEmoji} ${result.summary}`)
    lines.push('')

    // Configuration validation results
    lines.push('📋 Configuration Validation:')
    const configLines = CloudflareConfigValidator.formatValidationResults(result.configValidation)
    lines.push(configLines.split('\n').map(line => `  ${line}`).join('\n'))

    // Setup verification results (if available)
    if (result.setupVerification) {
      lines.push('')
      lines.push('🔧 Setup Verification:')
      const setupLines = CloudflareSetupVerifier.formatVerificationResults(result.setupVerification)
      lines.push(setupLines.split('\n').map(line => `  ${line}`).join('\n'))
    }

    // Overall recommendations
    if (result.recommendations.length > 0) {
      lines.push('')
      lines.push('🎯 Overall Recommendations:')
      for (const recommendation of result.recommendations) {
        lines.push(`  • ${recommendation}`)
      }
    }

    return lines.join('\n')
  }

  /**
   * Create validation service with specific options for different use cases
   */
  static forQuickCheck(): CloudflareValidationService {
    return new CloudflareValidationService({
      validateCredentials: false,
      checkEnvironmentVariables: true,
      validateConnectivity: false,
      skipSetupVerification: true,
    })
  }

  static forCredentialCheck(): CloudflareValidationService {
    return new CloudflareValidationService({
      validateCredentials: true,
      checkEnvironmentVariables: true,
      validateConnectivity: false,
      skipSetupVerification: true,
    })
  }

  static forFullValidation(): CloudflareValidationService {
    return new CloudflareValidationService({
      validateCredentials: true,
      checkEnvironmentVariables: true,
      validateConnectivity: true,
      skipSetupVerification: false,
    })
  }

  static forHealthCheck(): CloudflareValidationService {
    return new CloudflareValidationService({
      validateCredentials: true,
      checkEnvironmentVariables: false,
      validateConnectivity: true,
      skipSetupVerification: false,
    })
  }
}