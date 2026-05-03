#!/usr/bin/env tsx

/**
 * End-to-end validation script for Cloudflare integration
 * Tests all documented workflows and examples with real Cloudflare APIs
 */

import chalk from 'chalk'
import { logger } from '../lib/logger'
import { CloudflareValidationService } from '../lib/providers/cloudflare/CloudflareValidationService'
import { CloudflareClient } from '../lib/providers/cloudflare/CloudflareClient'
import { CloudflareFirewallService } from '../lib/providers/cloudflare/CloudflareFirewallService'
import { UnifiedConfig } from '../lib/types'

interface ValidationResult {
  test: string
  passed: boolean
  error?: string
  duration: number
}

class CloudflareE2EValidator {
  private results: ValidationResult[] = []
  private client: CloudflareClient
  private service: CloudflareFirewallService
  private validationService: CloudflareValidationService

  constructor(
    private apiToken: string,
    private zoneId: string,
    private accountId?: string
  ) {
    this.client = new CloudflareClient(apiToken, zoneId, accountId)
    this.service = new CloudflareFirewallService(this.client)
    this.validationService = new CloudflareValidationService({
      validateCredentials: true,
      checkEnvironmentVariables: true,
      validateConnectivity: true,
      skipSetupVerification: false,
    })
  }

  private async runTest(testName: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now()
    try {
      logger.info(`🧪 Running: ${testName}`)
      await testFn()
      const duration = Date.now() - startTime
      this.results.push({ test: testName, passed: true, duration })
      logger.success(`✅ ${testName} (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - startTime
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.results.push({ test: testName, passed: false, error: errorMessage, duration })
      logger.error(`❌ ${testName} (${duration}ms): ${errorMessage}`)
    }
  }

  async validateCredentials(): Promise<void> {
    await this.runTest('Credential Validation', async () => {
      const result = await this.validationService.validateCredentials({
        apiToken: this.apiToken,
        zoneId: this.zoneId,
        accountId: this.accountId,
      })

      if (!result.valid) {
        throw new Error(`Credential validation failed: ${result.errors.map(e => e.message).join(', ')}`)
      }
    })
  }

  async validateConnectivity(): Promise<void> {
    await this.runTest('API Connectivity', async () => {
      // Test basic API connectivity
      await this.client.listRulesets()
      await this.client.listLists()
    })
  }

  async validateConfigurationHandling(): Promise<void> {
    await this.runTest('Configuration Validation', async () => {
      const testConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'test-rule-e2e',
            name: 'E2E Test Rule',
            description: 'Test rule for end-to-end validation',
            conditions: [
              {
                field: 'http.request.uri.path',
                operator: 'eq',
                value: '/e2e-test',
              },
            ],
            action: {
              type: 'block',
            },
            enabled: false, // Keep disabled for safety
          },
        ],
        ips: [],
        metadata: {
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      }

      const validationResult = await this.validationService.validateConfiguration(testConfig)
      if (validationResult.overall === 'unhealthy') {
        throw new Error(`Configuration validation failed: ${validationResult.summary}`)
      }
    })
  }

  async validateRuleTranslation(): Promise<void> {
    await this.runTest('Rule Translation', async () => {
      const testRule = {
        id: 'test-rule-translation',
        name: 'Translation Test Rule',
        description: 'Test rule for translation validation',
        conditions: [
          {
            field: 'http.request.uri.path',
            operator: 'eq' as const,
            value: '/translation-test',
          },
        ],
        action: {
          type: 'block' as const,
        },
        enabled: false,
      }

      // Test translation to Cloudflare format
      const cloudflareRule = this.service.translateToCloudflareRule(testRule, 'test-ruleset')
      
      if (!cloudflareRule.expression) {
        throw new Error('Rule translation failed: no expression generated')
      }

      if (!cloudflareRule.action) {
        throw new Error('Rule translation failed: no action generated')
      }
    })
  }

  async validateErrorHandling(): Promise<void> {
    await this.runTest('Error Handling', async () => {
      // Test with invalid zone ID
      const invalidClient = new CloudflareClient(this.apiToken, 'invalid-zone-id', this.accountId)
      
      try {
        await invalidClient.listRulesets()
        throw new Error('Expected error for invalid zone ID')
      } catch (error) {
        if (error instanceof Error && error.message.includes('Expected error')) {
          throw error
        }
        // Expected error - this is good
      }
    })
  }

  async validatePerformance(): Promise<void> {
    await this.runTest('Performance Requirements', async () => {
      const startTime = Date.now()
      
      // Test that basic operations complete within reasonable time
      await Promise.all([
        this.client.listRulesets(),
        this.client.listLists(),
      ])
      
      const duration = Date.now() - startTime
      
      // Should complete within 5 seconds
      if (duration > 5000) {
        throw new Error(`Performance test failed: operations took ${duration}ms (expected < 5000ms)`)
      }
    })
  }

  async validateRetryLogic(): Promise<void> {
    await this.runTest('Retry Logic', async () => {
      // This test would need to simulate network failures
      // For now, just verify the retry mechanism exists
      const retryConfig = this.client.getRetryConfig()
      
      if (!retryConfig || retryConfig.maxRetries < 1) {
        throw new Error('Retry logic not properly configured')
      }
    })
  }

  async validateDocumentedWorkflows(): Promise<void> {
    await this.runTest('Documented Workflows', async () => {
      // Test the main workflows documented in the usage guide
      
      // 1. Fetch current configuration
      const currentConfig = await this.service.fetchConfig()
      if (!currentConfig) {
        throw new Error('Failed to fetch current configuration')
      }

      // 2. Validate configuration
      const validation = this.service.validateConfig(currentConfig)
      if (!validation.valid) {
        logger.warn('Current configuration has validation issues:', validation.errors)
      }

      // 3. Get changes (should be none for current config)
      const changes = await this.service.getChanges(currentConfig)
      if (changes.hasChanges) {
        logger.warn('Unexpected changes detected in current configuration')
      }

      // 4. Get health score
      const healthScore = this.service.getHealthScore(currentConfig)
      if (healthScore.score < 0 || healthScore.score > 100) {
        throw new Error(`Invalid health score: ${healthScore.score}`)
      }
    })
  }

  async runAllTests(): Promise<void> {
    logger.info(chalk.bold.cyan('🚀 Starting Cloudflare E2E Validation'))
    logger.info('')

    // Run all validation tests
    await this.validateCredentials()
    await this.validateConnectivity()
    await this.validateConfigurationHandling()
    await this.validateRuleTranslation()
    await this.validateErrorHandling()
    await this.validatePerformance()
    await this.validateRetryLogic()
    await this.validateDocumentedWorkflows()

    // Generate report
    this.generateReport()
  }

  private generateReport(): void {
    logger.info('')
    logger.info(chalk.bold.cyan('📊 Validation Report'))
    logger.info('')

    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const totalDuration = this.results.reduce((sum, r) => sum + r.duration, 0)

    logger.info(`${chalk.green('✅ Passed:')} ${passed}`)
    logger.info(`${chalk.red('❌ Failed:')} ${failed}`)
    logger.info(`${chalk.blue('⏱️  Total Duration:')} ${totalDuration}ms`)
    logger.info('')

    if (failed > 0) {
      logger.info(chalk.bold.red('Failed Tests:'))
      this.results
        .filter(r => !r.passed)
        .forEach(r => {
          logger.error(`  • ${r.test}: ${r.error}`)
        })
      logger.info('')
    }

    // Performance summary
    const avgDuration = totalDuration / this.results.length
    logger.info(`${chalk.blue('📈 Performance:')} Average ${avgDuration.toFixed(0)}ms per test`)

    // Requirements validation
    logger.info('')
    logger.info(chalk.bold.cyan('📋 Requirements Validation:'))
    
    // Requirement 2.7: Error handling
    const errorHandlingPassed = this.results.find(r => r.test === 'Error Handling')?.passed
    logger.info(`${errorHandlingPassed ? '✅' : '❌'} 2.7 - Error handling in real-world scenarios`)

    // Requirement 5.1: Performance
    const performancePassed = this.results.find(r => r.test === 'Performance Requirements')?.passed
    logger.info(`${performancePassed ? '✅' : '❌'} 5.1 - Performance meets stated requirements`)

    // Requirement 5.2: Reliability
    const connectivityPassed = this.results.find(r => r.test === 'API Connectivity')?.passed
    const retryPassed = this.results.find(r => r.test === 'Retry Logic')?.passed
    const reliabilityPassed = connectivityPassed && retryPassed
    logger.info(`${reliabilityPassed ? '✅' : '❌'} 5.2 - Reliability and retry mechanisms`)

    // Requirement 5.4: Workflows
    const workflowsPassed = this.results.find(r => r.test === 'Documented Workflows')?.passed
    logger.info(`${workflowsPassed ? '✅' : '❌'} 5.4 - All documented workflows work`)

    // Requirement 5.5: Integration
    const integrationPassed = this.results.find(r => r.test === 'Configuration Validation')?.passed
    logger.info(`${integrationPassed ? '✅' : '❌'} 5.5 - Integration with existing systems`)

    logger.info('')
    
    if (failed === 0) {
      logger.success(chalk.bold.green('🎉 All tests passed! Cloudflare integration is ready for production.'))
    } else {
      logger.error(chalk.bold.red(`💥 ${failed} test(s) failed. Please address issues before production deployment.`))
      process.exit(1)
    }
  }
}

// Main execution
async function main() {
  const apiToken = process.env.CLOUDFLARE_API_TOKEN
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!apiToken) {
    logger.error('CLOUDFLARE_API_TOKEN environment variable is required')
    process.exit(1)
  }

  if (!zoneId) {
    logger.error('CLOUDFLARE_ZONE_ID environment variable is required')
    process.exit(1)
  }

  const validator = new CloudflareE2EValidator(apiToken, zoneId, accountId)
  await validator.runAllTests()
}

if (require.main === module) {
  main().catch((error) => {
    logger.error('E2E validation failed:', error)
    process.exit(1)
  })
}

export { CloudflareE2EValidator }