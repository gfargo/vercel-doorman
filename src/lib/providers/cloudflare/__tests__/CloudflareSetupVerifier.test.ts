import { CloudflareSetupVerifier } from '../CloudflareSetupVerifier'
import { CloudflareClient } from '../CloudflareClient'
import { CloudflareValidator } from '../CloudflareValidator'
import type { UnifiedConfig } from '../../../types/unified'

// Mock the dependencies
jest.mock('../CloudflareClient')
jest.mock('../CloudflareValidator')

const MockedCloudflareClient = CloudflareClient as jest.MockedClass<typeof CloudflareClient>
const MockedCloudflareValidator = CloudflareValidator as jest.MockedClass<typeof CloudflareValidator>

describe('CloudflareSetupVerifier', () => {
  let verifier: CloudflareSetupVerifier
  let mockClient: jest.Mocked<CloudflareClient>
  let mockValidator: jest.Mocked<CloudflareValidator>

  beforeEach(() => {
    jest.clearAllMocks()

    // Setup mocks
    mockClient = {
      getZoneInfo: jest.fn(),
      getRulesets: jest.fn(),
      listLists: jest.fn(),
    } as any

    mockValidator = {
      testConnectivity: jest.fn(),
      validateApiToken: jest.fn(),
      validateZoneAccess: jest.fn(),
      validateAccountAccess: jest.fn(),
      validateListsApiAvailability: jest.fn(),
    } as any

    MockedCloudflareClient.mockImplementation(() => mockClient)
    MockedCloudflareValidator.mockImplementation(() => mockValidator)

    verifier = new CloudflareSetupVerifier('test-token', 'test-zone-id', 'test-account-id')
  })

  describe('verifySetup', () => {
    it('should pass all checks for healthy setup', async () => {
      // Mock successful responses
      mockValidator.testConnectivity.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: ['API connectivity test passed'],
      })

      mockValidator.validateApiToken.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
      })

      mockValidator.validateZoneAccess.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
      })

      mockValidator.validateAccountAccess.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
      })

      mockValidator.validateListsApiAvailability.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: ['Lists API is available and functional'],
      })

      mockClient.getZoneInfo.mockResolvedValue({
        id: 'test-zone-id',
        name: 'example.com',
        status: 'active',
        plan: { name: 'Free' },
      })

      mockClient.getRulesets.mockResolvedValue([
        {
          id: 'test-ruleset-id',
          name: 'Test Ruleset',
          kind: 'custom',
          phase: 'http_request_firewall_custom',
          version: '1',
          rules: [],
          last_updated: '2023-01-01T00:00:00Z',
        },
      ])

      const result = await verifier.verifySetup()

      expect(result.overall).toBe('healthy')
      expect(result.features.basicFirewallRules).toBe(true)
      expect(result.features.listsApi).toBe(true)
      expect(result.checks.filter((c) => c.status === 'pass')).toHaveLength(9) // All checks should pass
    })

    it('should handle connectivity failures', async () => {
      mockValidator.testConnectivity.mockResolvedValue({
        valid: false,
        errors: [
          {
            field: 'connectivity',
            message: 'Failed to connect to Cloudflare API',
            suggestion: 'Check your internet connection',
          },
        ],
        warnings: [],
        suggestions: [],
      })

      const result = await verifier.verifySetup()

      expect(result.overall).toBe('unhealthy')
      expect(result.checks.find((c) => c.name === 'API Connectivity')?.status).toBe('fail')
    })

    it('should handle invalid API token', async () => {
      mockValidator.testConnectivity.mockResolvedValue({
        valid: true,
        errors: [],
        warnings: [],
        suggestions: [],
      })

      mockValidator.validateApiToken.mockResolvedValue({
        valid: false,
        errors: [
          {
            field: 'apiToken',
            message: 'API token is invalid',
            suggestion: 'Check your API token',
          },
        ],
        warnings: [],
        suggestions: [],
      })

      const result = await verifier.verifySetup()

      expect(result.overall).toBe('unhealthy')
      expect(result.checks.find((c) => c.name === 'API Token Validation')?.status).toBe('fail')
    })

    it('should handle zone access failures', async () => {
      mockValidator.testConnectivity.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateApiToken.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })

      mockValidator.validateZoneAccess.mockResolvedValue({
        valid: false,
        errors: [
          {
            field: 'zoneId',
            message: 'Zone access failed',
            suggestion: 'Check zone ID and permissions',
          },
        ],
        warnings: [],
        suggestions: [],
      })

      const result = await verifier.verifySetup()

      expect(result.overall).toBe('unhealthy')
      expect(result.features.basicFirewallRules).toBe(false)
      expect(result.checks.find((c) => c.name === 'Zone Access')?.status).toBe('fail')
    })

    it('should handle account access warnings gracefully', async () => {
      mockValidator.testConnectivity.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateApiToken.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateZoneAccess.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })

      mockValidator.validateAccountAccess.mockResolvedValue({
        valid: false,
        errors: [],
        warnings: [
          {
            field: 'accountId',
            message: 'Account access limited',
            impact: 'Lists API will not be available',
          },
        ],
        suggestions: ['Check account permissions'],
      })

      mockClient.getZoneInfo.mockResolvedValue({
        id: 'test-zone-id',
        name: 'example.com',
        status: 'active',
      })

      mockClient.getRulesets.mockResolvedValue([])

      const result = await verifier.verifySetup()

      expect(result.overall).toBe('degraded') // Should be degraded, not unhealthy
      expect(result.features.listsApi).toBe(false)
      expect(result.checks.find((c) => c.name === 'Account Access')?.status).toBe('warning')
    })

    it('should skip account checks when no account ID provided', async () => {
      const verifierWithoutAccount = new CloudflareSetupVerifier('test-token', 'test-zone-id')

      mockValidator.testConnectivity.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateApiToken.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateZoneAccess.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })

      mockClient.getZoneInfo.mockResolvedValue({
        id: 'test-zone-id',
        name: 'example.com',
        status: 'active',
      })

      mockClient.getRulesets.mockResolvedValue([])

      const result = await verifierWithoutAccount.verifySetup()

      expect(result.checks.find((c) => c.name === 'Account Access')).toBeUndefined()
      expect(result.checks.find((c) => c.name === 'Lists API')).toBeUndefined()
      expect(result.features.listsApi).toBe(false)
    })

    it('should handle zone status warnings', async () => {
      mockValidator.testConnectivity.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateApiToken.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateZoneAccess.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })

      mockClient.getZoneInfo.mockResolvedValue({
        id: 'test-zone-id',
        name: 'example.com',
        status: 'pending',
      })

      mockClient.getRulesets.mockResolvedValue([])

      const result = await verifier.verifySetup()

      expect(result.overall).toBe('degraded')
      expect(result.checks.find((c) => c.name === 'Zone Information')?.message).toContain('pending')
    })

    it('should measure API performance', async () => {
      mockValidator.testConnectivity.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateApiToken.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })
      mockValidator.validateZoneAccess.mockResolvedValue({ valid: true, errors: [], warnings: [], suggestions: [] })

      // Mock slow API response
      mockClient.getZoneInfo.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  id: 'test-zone-id',
                  name: 'example.com',
                  status: 'active',
                }),
              100,
            ),
          ),
      )

      mockClient.getRulesets.mockResolvedValue([])

      const result = await verifier.verifySetup()

      const performanceCheck = result.checks.find((c) => c.name === 'API Performance')
      expect(performanceCheck).toBeDefined()
      expect(performanceCheck?.message).toContain('ms')
    })
  })

  describe('fromConfig', () => {
    it('should create verifier from unified config', () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'

      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
            accountId: 'test-account-id',
          },
        },
        rules: [],
        ips: [],
      }

      const verifier = CloudflareSetupVerifier.fromConfig(config)
      expect(verifier).toBeInstanceOf(CloudflareSetupVerifier)
    })

    it('should throw error when API token is missing', () => {
      delete process.env.CLOUDFLARE_API_TOKEN

      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
          },
        },
        rules: [],
        ips: [],
      }

      expect(() => CloudflareSetupVerifier.fromConfig(config)).toThrow(
        'CLOUDFLARE_API_TOKEN environment variable is required',
      )
    })

    it('should throw error when zone ID is missing', () => {
      process.env.CLOUDFLARE_API_TOKEN = 'test-token'

      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {},
        },
        rules: [],
        ips: [],
      }

      expect(() => CloudflareSetupVerifier.fromConfig(config)).toThrow(
        'Zone ID is required (set in config or CLOUDFLARE_ZONE_ID environment variable)',
      )
    })
  })

  describe('formatVerificationResults', () => {
    it('should format healthy results correctly', () => {
      const result = {
        overall: 'healthy' as const,
        summary: 'All checks passed',
        checks: [
          {
            name: 'Test Check',
            status: 'pass' as const,
            message: 'Test passed',
            duration: 100,
          },
        ],
        features: {
          basicFirewallRules: true,
          ipBlocking: true,
          listsApi: true,
          rateLimiting: true,
          customResponses: true,
          redirects: true,
        },
        recommendations: ['Everything looks good'],
      }

      const formatted = CloudflareSetupVerifier.formatVerificationResults(result)

      expect(formatted).toContain('✅ All checks passed')
      expect(formatted).toContain('🔧 Feature Availability:')
      expect(formatted).toContain('✅ Basic Firewall Rules')
      expect(formatted).toContain('✅ Lists API (Bulk IP Management)')
      expect(formatted).toContain('🔍 Detailed Results:')
      expect(formatted).toContain('✅ Test Check: Test passed (100ms)')
      expect(formatted).toContain('💡 Recommendations:')
      expect(formatted).toContain('• Everything looks good')
    })

    it('should format unhealthy results correctly', () => {
      const result = {
        overall: 'unhealthy' as const,
        summary: 'Setup has critical issues',
        checks: [
          {
            name: 'Failed Check',
            status: 'fail' as const,
            message: 'Test failed',
            details: 'Additional error details',
          },
        ],
        features: {
          basicFirewallRules: false,
          ipBlocking: false,
          listsApi: false,
          rateLimiting: false,
          customResponses: false,
          redirects: false,
        },
        recommendations: ['Fix the errors above'],
      }

      const formatted = CloudflareSetupVerifier.formatVerificationResults(result)

      expect(formatted).toContain('❌ Setup has critical issues')
      expect(formatted).toContain('❌ Basic Firewall Rules')
      expect(formatted).toContain('❌ Lists API (Bulk IP Management)')
      expect(formatted).toContain('❌ Failed Check: Test failed')
      expect(formatted).toContain('Additional error details')
      expect(formatted).toContain('• Fix the errors above')
    })
  })
})
