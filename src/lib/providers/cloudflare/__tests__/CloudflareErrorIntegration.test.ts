import { CloudflareClient } from '../CloudflareClient'
import { CloudflareFirewallService } from '../CloudflareFirewallService'
import { DoormanError } from '../../../errors/DoormanError'
import { CloudflareErrorCode, ProviderErrorCode } from '../../../errors/ErrorCodes'

// Mock the BaseFirewallClient to avoid actual HTTP requests
jest.mock('../../BaseFirewallClient')

describe('Cloudflare Error Handling Integration', () => {
  let client: CloudflareClient
  let service: CloudflareFirewallService

  beforeEach(() => {
    client = new CloudflareClient('test-token', 'test-zone-id', 'test-account-id')
    service = new CloudflareFirewallService('test-token', 'test-zone-id', 'test-account-id')
  })

  describe('CloudflareClient error handling', () => {
    it('should handle credential validation errors', async () => {
      // Mock the get method to simulate an unauthorized response
      const mockGet = jest
        .spyOn(client as any, 'get')
        .mockRejectedValue(new Error('Request failed with status code 401'))

      const result = await client.verifyCredentials()

      expect(result).toBe(false)
      expect(mockGet).toHaveBeenCalled()
    })

    it('should throw proper DoormanError for API failures', async () => {
      // Mock the get method to return a failed Cloudflare response
      const mockGet = jest.spyOn(client as any, 'get').mockResolvedValue({
        success: false,
        errors: [{ code: 10000, message: 'Authentication failed' }],
        messages: [],
        result: null,
      })

      await expect(client.listRulesets()).rejects.toThrow(DoormanError)
      await expect(client.listRulesets()).rejects.toMatchObject({
        code: ProviderErrorCode.AUTH_FAILED,
        message: expect.stringContaining('Authentication failed'),
      })

      expect(mockGet).toHaveBeenCalled()
    })

    it('should handle network errors properly', async () => {
      // Mock the get method to simulate a network error
      const mockGet = jest
        .spyOn(client as any, 'get')
        .mockRejectedValue(new Error('getaddrinfo ENOTFOUND api.cloudflare.com'))

      await expect(client.listRulesets()).rejects.toThrow(DoormanError)
      await expect(client.listRulesets()).rejects.toMatchObject({
        code: expect.stringContaining('NET_'),
        message: expect.stringContaining('Network'),
      })

      expect(mockGet).toHaveBeenCalled()
    })
  })

  describe('CloudflareFirewallService validation', () => {
    it('should validate configuration and return proper error codes', () => {
      const invalidConfig = {
        version: '2.0' as const,
        provider: 'cloudflare' as const,
        providers: {
          cloudflare: {
            zoneId: 'test-zone',
            accountId: 'test-account',
          },
        },
        rules: [
          {
            id: 'test-rule',
            name: 'Test Rule',
            enabled: true,
            conditions: [], // Empty conditions should trigger error
            action: {
              type: 'block' as const,
            },
          },
        ],
        ips: [
          {
            id: 'test-ip',
            ip: '999.999.999.999', // Invalid IP should trigger error
            action: 'deny' as const,
          },
        ],
      }

      const result = service.validateConfig(invalidConfig)

      expect(result.valid).toBe(false)
      expect(result.errors).toHaveLength(2)

      // Check for rule validation error
      const ruleError = result.errors.find((e) => e.code === CloudflareErrorCode.RULE_NO_CONDITIONS)
      expect(ruleError).toBeDefined()
      expect(ruleError?.message).toContain('no conditions')

      // Check for IP validation error
      const ipError = result.errors.find((e) => e.code === CloudflareErrorCode.INVALID_IP)
      expect(ipError).toBeDefined()
      expect(ipError?.message).toContain('Invalid IP address')
    })

    it('should generate warnings for large IP lists without account ID', () => {
      const serviceWithoutAccount = new CloudflareFirewallService('test-token', 'test-zone-id')

      const configWithManyIPs = {
        version: '2.0' as const,
        provider: 'cloudflare' as const,
        providers: {
          cloudflare: {
            zoneId: 'test-zone',
          },
        },
        rules: [],
        ips: Array.from({ length: 60 }, (_, i) => ({
          id: `ip-${i}`,
          ip: `192.168.1.${i + 1}`,
          action: 'deny' as const,
        })),
      }

      const result = serviceWithoutAccount.validateConfig(configWithManyIPs)

      expect(result.valid).toBe(true) // Should be valid but with warnings
      expect(result.warnings).toHaveLength(1)

      const warning = result.warnings[0]
      expect(warning).toBeDefined()
      expect(warning!.code).toBe(CloudflareErrorCode.LARGE_IP_LIST)
      expect(warning!.message).toContain('Large IP list')
      expect(warning!.message).toContain('60 IPs')
    })

    it('should validate rate limiting configuration', () => {
      const configWithInvalidRateLimit = {
        version: '2.0' as const,
        provider: 'cloudflare' as const,
        providers: {
          cloudflare: {
            zoneId: 'test-zone',
          },
        },
        rules: [
          {
            id: 'rate-limit-rule',
            name: 'Rate Limit Rule',
            enabled: true,
            conditions: [
              {
                field: 'ip.src',
                operator: 'eq' as const,
                value: '192.168.1.1',
              },
            ],
            action: {
              type: 'rate_limit' as const,
              rateLimit: {
                requests: 0, // Invalid: should be at least 1
                window: 'invalid-format', // Invalid format
                characteristics: [], // Empty array should trigger warning
                mitigationTimeout: 30, // Too short, should trigger warning
              },
            },
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(configWithInvalidRateLimit)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.warnings.length).toBeGreaterThan(0)

      // Check for rate limit validation errors
      const rateLimitError = result.errors.find((e) => e.code === CloudflareErrorCode.INVALID_RATE_LIMIT)
      expect(rateLimitError).toBeDefined()

      const windowFormatError = result.errors.find((e) => e.code === CloudflareErrorCode.INVALID_WINDOW_FORMAT)
      expect(windowFormatError).toBeDefined()

      // Check for warnings
      const characteristicsWarning = result.warnings.find((w) => w.code === CloudflareErrorCode.EMPTY_CHARACTERISTICS)
      expect(characteristicsWarning).toBeDefined()

      const timeoutWarning = result.warnings.find((w) => w.code === CloudflareErrorCode.SHORT_MITIGATION_TIMEOUT)
      expect(timeoutWarning).toBeDefined()
    })
  })

  describe('Error message formatting', () => {
    it('should format errors with proper structure', () => {
      const invalidConfig = {
        version: '2.0' as const,
        provider: 'cloudflare' as const,
        providers: {
          cloudflare: {
            zoneId: 'test-zone',
          },
        },
        rules: [
          {
            id: 'invalid-rule',
            name: 'Invalid Rule',
            enabled: true,
            conditions: [],
            action: {
              type: 'block' as const,
            },
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(invalidConfig)
      const error = result.errors[0]

      expect(error).toMatchObject({
        path: expect.stringContaining('rules'),
        message: expect.stringContaining('no conditions'),
        code: CloudflareErrorCode.RULE_NO_CONDITIONS,
      })
    })
  })
})
