import { CloudflareConfigValidator } from '../CloudflareConfigValidator'
import type { UnifiedConfig } from '../../../types/unified'

// Mock the CloudflareValidator
jest.mock('../CloudflareValidator')

describe('CloudflareConfigValidator', () => {
  let validator: CloudflareConfigValidator
  let mockConfig: UnifiedConfig

  beforeEach(() => {
    validator = new CloudflareConfigValidator({
      validateCredentials: false,
      checkEnvironmentVariables: true,
      validateConnectivity: false,
    })

    mockConfig = {
      version: '2.0',
      provider: 'cloudflare',
      providers: {
        cloudflare: {
          zoneId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
          accountId: 'b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7',
        },
      },
      rules: [],
      ips: [],
    }

    // Clear environment variables
    delete process.env.CLOUDFLARE_API_TOKEN
    delete process.env.CLOUDFLARE_ZONE_ID
    delete process.env.CLOUDFLARE_ACCOUNT_ID
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  describe('validateConfig', () => {
    it('should pass validation for valid Cloudflare config', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token-with-valid-length-and-format'
      process.env.CLOUDFLARE_ZONE_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'

      const result = await validator.validateConfig(mockConfig)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should skip validation for non-Cloudflare provider', async () => {
      const vercelConfig = { ...mockConfig, provider: 'vercel' as const }

      const result = await validator.validateConfig(vercelConfig)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should fail validation when providers section is missing', async () => {
      const configWithoutProviders = { ...mockConfig }
      delete configWithoutProviders.providers

      const result = await validator.validateConfig(configWithoutProviders)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'providers',
          message: 'Missing providers configuration section',
          severity: 'error',
        }),
      )
    })

    it('should fail validation when Cloudflare provider config is missing', async () => {
      const configWithoutCloudflare = {
        ...mockConfig,
        providers: {},
      }

      const result = await validator.validateConfig(configWithoutCloudflare)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'providers.cloudflare',
          message: 'Missing Cloudflare provider configuration',
          severity: 'error',
        }),
      )
    })

    it('should detect missing API token', async () => {
      const result = await validator.validateConfig(mockConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'environment.CLOUDFLARE_API_TOKEN',
          message: 'Cloudflare API token is required but not found',
          severity: 'error',
        }),
      )
    })

    it('should detect missing zone ID', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      const configWithoutZoneId = {
        ...mockConfig,
        providers: {
          cloudflare: {
            accountId: 'test-account-id',
          },
        },
      }

      const result = await validator.validateConfig(configWithoutZoneId)

      expect(result.valid).toBe(false)
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'providers.cloudflare.zoneId',
          message: 'Cloudflare Zone ID is required but not found',
          severity: 'error',
        }),
      )
    })

    it('should warn about missing account ID', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      const configWithoutAccountId = {
        ...mockConfig,
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
          },
        },
      }

      const result = await validator.validateConfig(configWithoutAccountId)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'providers.cloudflare.accountId',
          message: 'Account ID not provided - Lists API will not be available',
          severity: 'info',
        }),
      )
    })

    it('should detect environment variable conflicts', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      process.env.CLOUDFLARE_ZONE_ID = 'env-zone-id'

      const result = await validator.validateConfig(mockConfig)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'providers.cloudflare.zoneId',
          message: 'Zone ID specified in both config file and environment variable',
          severity: 'warning',
        }),
      )
      expect(result.environmentVariables.conflicts).toContain('CLOUDFLARE_ZONE_ID')
    })

    it('should validate zone ID format', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      const configWithInvalidZoneId = {
        ...mockConfig,
        providers: {
          cloudflare: {
            zoneId: 'invalid-zone-id',
          },
        },
      }

      const result = await validator.validateConfig(configWithInvalidZoneId)

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'providers.cloudflare.zoneId',
          message: 'Zone ID format appears invalid',
          severity: 'error',
        }),
      )
    })

    it('should validate account ID format', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      const configWithInvalidAccountId = {
        ...mockConfig,
        providers: {
          cloudflare: {
            zoneId: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
            accountId: 'invalid-account-id',
          },
        },
      }

      const result = await validator.validateConfig(configWithInvalidAccountId)

      expect(result.errors).toContainEqual(
        expect.objectContaining({
          field: 'providers.cloudflare.accountId',
          message: 'Account ID format appears invalid',
          severity: 'error',
        }),
      )
    })

    it('should warn about unusual API token format', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'short'

      const result = await validator.validateConfig(mockConfig)

      expect(result.warnings).toContainEqual(
        expect.objectContaining({
          field: 'environment.CLOUDFLARE_API_TOKEN',
          message: 'API token format appears unusual',
          severity: 'warning',
        }),
      )
    })

    it('should generate appropriate suggestions', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token-with-valid-length-and-format'
      process.env.CLOUDFLARE_ZONE_ID = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'

      const configWithoutAccountId = {
        ...mockConfig,
        providers: {
          cloudflare: {
            zoneId: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6',
          },
        },
      }

      const result = await validator.validateConfig(configWithoutAccountId)

      expect(result.suggestions).toContain(
        'Consider adding Account ID to enable Lists API for better IP management performance',
      )
    })

    it('should detect environment variables correctly', async () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'
      process.env.CLOUDFLARE_ZONE_ID = 'test-zone-id'
      process.env.CLOUDFLARE_ACCOUNT_ID = 'test-account-id'

      const result = await validator.validateConfig(mockConfig)

      expect(result.environmentVariables.detected).toEqual([
        'CLOUDFLARE_API_TOKEN',
        'CLOUDFLARE_ZONE_ID',
        'CLOUDFLARE_ACCOUNT_ID',
      ])
      expect(result.environmentVariables.missing).toEqual([])
    })
  })

  describe('formatValidationResults', () => {
    it('should format validation results correctly', () => {
      const result = {
        valid: false,
        errors: [
          {
            field: 'test.field',
            message: 'Test error message',
            suggestion: 'Test suggestion',
            docsUrl: 'https://example.com/docs',
            severity: 'error' as const,
          },
        ],
        warnings: [
          {
            field: 'test.warning',
            message: 'Test warning message',
            suggestion: 'Test warning suggestion',
            severity: 'warning' as const,
          },
        ],
        suggestions: ['Test suggestion 1', 'Test suggestion 2'],
        environmentVariables: {
          detected: ['CLOUDFLARE_API_TOKEN'],
          missing: ['CLOUDFLARE_ZONE_ID'],
          conflicts: ['CLOUDFLARE_ACCOUNT_ID'],
        },
      }

      const formatted = CloudflareConfigValidator.formatValidationResults(result)

      expect(formatted).toContain('❌ Cloudflare configuration has errors')
      expect(formatted).toContain('🚨 Errors:')
      expect(formatted).toContain('test.field: Test error message')
      expect(formatted).toContain('💡 Test suggestion')
      expect(formatted).toContain('📖 https://example.com/docs')
      expect(formatted).toContain('⚠️  Warnings:')
      expect(formatted).toContain('test.warning: Test warning message')
      expect(formatted).toContain('🌍 Environment Variables:')
      expect(formatted).toContain('✅ Found: CLOUDFLARE_API_TOKEN')
      expect(formatted).toContain('❌ Missing: CLOUDFLARE_ZONE_ID')
      expect(formatted).toContain('⚠️  Conflicts: CLOUDFLARE_ACCOUNT_ID')
      expect(formatted).toContain('💡 Suggestions:')
      expect(formatted).toContain('• Test suggestion 1')
      expect(formatted).toContain('• Test suggestion 2')
    })

    it('should format valid configuration correctly', () => {
      const result = {
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

      const formatted = CloudflareConfigValidator.formatValidationResults(result)

      expect(formatted).toContain('✅ Cloudflare configuration is valid')
    })
  })
})
