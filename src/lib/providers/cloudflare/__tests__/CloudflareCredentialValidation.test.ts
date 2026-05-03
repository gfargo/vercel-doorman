import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { CloudflareValidator } from '../CloudflareValidator'
import type { CloudflareCredentials } from '../CloudflareValidator'

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>
global.fetch = mockFetch

// Mock logger
jest.mock('../../../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}))

// Helper to build Response-like objects
const makeResponse = (init: {
  ok: boolean
  status: number
  statusText?: string
  jsonBody?: unknown
  headers?: Record<string, string>
}): Response => {
  const headers = new Headers(init.headers || {})
  const body = init.jsonBody
  const res = {
    ok: init.ok,
    status: init.status,
    statusText: init.statusText || '',
    headers,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response
  return res
}

describe('Cloudflare Credential Validation', () => {
  let validator: CloudflareValidator

  beforeEach(() => {
    validator = new CloudflareValidator('test-token', 'test-zone')
    mockFetch.mockClear()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('API Token Validation', () => {
    it('should validate token format correctly', async () => {
      const validTokens = [
        'abcdef1234567890abcdef1234567890abcdef12',
        'token-with-hyphens-123456789012345678',
        'token_with_underscores_123456789012345',
        'MixedCaseToken123456789012345678901234',
        'very-long-token-that-should-still-be-valid-123456789012345678901234567890',
      ]

      for (const token of validTokens) {
        // Mock successful token verification
        mockFetch.mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'token123',
              status: 'active',
              policies: [{
                id: 'policy1',
                effect: 'allow',
                resources: { 'com.cloudflare.api.account.zone': 'zone123' },
                permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
              }],
            },
          },
        }))

        // Mock zone validation
        mockFetch.mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: { id: 'zone123', name: 'example.com', status: 'active' },
          },
        }))

        const result = await validator.validateCredentials({
          apiToken: token,
          zoneId: 'zone123',
        })

        const formatErrors = result.errors.filter(e => 
          e.message.includes('format') || 
          e.message.includes('Bearer') || 
          e.message.includes('too short')
        )
        expect(formatErrors).toHaveLength(0)
      }
    })

    it('should reject invalid token formats', async () => {
      const invalidTokens = [
        { token: '', expectedError: 'API token is required' },
        { token: '   ', expectedError: 'API token is required' },
        { token: 'Bearer valid-token-123456789012345678', expectedError: 'should not include "Bearer " prefix' },
        { token: 'short', expectedError: 'appears to be too short' },
        { token: 'token with spaces', expectedError: 'contains invalid characters' },
      ]

      for (const { token, expectedError } of invalidTokens) {
        const result = await validator.validateCredentials({
          apiToken: token,
          zoneId: 'zone123',
        })

        expect(result.valid).toBe(false)
        const hasExpectedError = result.errors.some(e => e.message.includes(expectedError))
        expect(hasExpectedError).toBe(true)
      }
    })

    it('should handle token verification API errors', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-format-token-123456789012345678',
        zoneId: 'zone123',
      }

      const errorScenarios = [
        {
          status: 401,
          response: { success: false, errors: [{ code: 10000, message: 'Invalid API token' }] },
          expectedError: 'Failed to verify API token',
        },
        {
          status: 403,
          response: { success: false, errors: [{ code: 10001, message: 'Token lacks required permissions' }] },
          expectedError: 'Failed to verify API token',
        },
        {
          status: 429,
          response: { success: false, errors: [{ code: 10013, message: 'Rate limit exceeded' }] },
          expectedError: 'Failed to verify API token',
        },
      ]

      for (const scenario of errorScenarios) {
        mockFetch.mockResolvedValueOnce(makeResponse({
          ok: false,
          status: scenario.status,
          jsonBody: scenario.response,
        }))

        const result = await validator.validateCredentials(credentials)

        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes(scenario.expectedError))).toBe(true)
      }
    })

    it('should handle network errors during token verification', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-format-token-123456789012345678',
        zoneId: 'zone123',
      }

      const networkErrors = [
        new Error('Network timeout'),
        new Error('getaddrinfo ENOTFOUND api.cloudflare.com'),
        new Error('connect ECONNREFUSED'),
        new Error('certificate verify failed'),
      ]

      for (const error of networkErrors) {
        mockFetch.mockRejectedValueOnce(error)

        const result = await validator.validateCredentials(credentials)

        expect(result.valid).toBe(false)
        expect(result.errors.some(e => e.message.includes('Failed to verify API token'))).toBe(true)
      }
    })
  })

  describe('Zone ID Validation', () => {
    it('should validate zone access with proper permissions', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'valid-zone-123',
      }

      // Mock successful token verification
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'token123',
            status: 'active',
            policies: [{
              id: 'policy1',
              effect: 'allow',
              resources: { 'com.cloudflare.api.account.zone': 'valid-zone-123' },
              permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
            }],
          },
        },
      }))

      // Mock successful zone info
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'valid-zone-123',
            name: 'example.com',
            status: 'active',
            permissions: ['zone:edit'],
          },
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should handle zone not found errors', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'non-existent-zone',
      }

      // Mock successful token verification
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'token123',
            status: 'active',
            policies: [{
              id: 'policy1',
              effect: 'allow',
              resources: { 'com.cloudflare.api.account.zone': '*' },
              permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
            }],
          },
        },
      }))

      // Mock zone not found
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: false,
        status: 404,
        jsonBody: {
          success: false,
          errors: [{ code: 1001, message: 'Zone not found' }],
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Zone not found'))).toBe(true)
    })

    it('should handle zone access permission errors', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'restricted-zone',
      }

      // Mock successful token verification
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'token123',
            status: 'active',
            policies: [{
              id: 'policy1',
              effect: 'allow',
              resources: { 'com.cloudflare.api.account.zone': 'other-zone' },
              permission_groups: [{ id: 'zone_read', name: 'Zone:Read' }],
            }],
          },
        },
      }))

      // Mock zone info success but insufficient permissions
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'restricted-zone',
            name: 'restricted.com',
            status: 'active',
            permissions: ['zone:read'], // Missing zone:edit
          },
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('not accessible'))).toBe(true)
    })

    it('should warn about inactive zone status', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'pending-zone',
      }

      // Mock successful token verification
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'token123',
            status: 'active',
            policies: [{
              id: 'policy1',
              effect: 'allow',
              resources: { 'com.cloudflare.api.account.zone': 'pending-zone' },
              permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
            }],
          },
        },
      }))

      // Mock zone with pending status
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'pending-zone',
            name: 'pending.com',
            status: 'pending',
            permissions: ['zone:edit'],
          },
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.message.includes("status is 'pending'"))).toBe(true)
    })
  })

  describe('Account ID Validation', () => {
    it('should validate account access for Lists API', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
        accountId: 'account123',
      }

      // Mock successful token verification
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'token123',
            status: 'active',
            policies: [{
              id: 'policy1',
              effect: 'allow',
              resources: {
                'com.cloudflare.api.account.zone': 'zone123',
                'com.cloudflare.api.account': 'account123',
              },
              permission_groups: [
                { id: 'zone_edit', name: 'Zone:Edit' },
                { id: 'account_read', name: 'Account:Read' },
              ],
            }],
          },
        },
      }))

      // Mock successful zone info
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: { id: 'zone123', name: 'example.com', status: 'active' },
        },
      }))

      // Mock successful account info
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: { id: 'account123', name: 'Test Account' },
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(true)
      expect(result.suggestions.some(s => s.includes('Lists API is available'))).toBe(true)
    })

    it('should handle account not found errors', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
        accountId: 'non-existent-account',
      }

      // Mock successful token and zone verification
      mockFetch
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'token123',
              status: 'active',
              policies: [{
                id: 'policy1',
                effect: 'allow',
                resources: { 'com.cloudflare.api.account.zone': 'zone123' },
                permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
              }],
            },
          },
        }))
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: { id: 'zone123', name: 'example.com', status: 'active' },
          },
        }))

      // Mock account not found
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: false,
        status: 404,
        jsonBody: {
          success: false,
          errors: [{ code: 1003, message: 'Account not found' }],
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Account not found'))).toBe(true)
    })

    it('should warn when account ID is not provided', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
        // No accountId provided
      }

      // Mock successful token and zone verification
      mockFetch
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'token123',
              status: 'active',
              policies: [{
                id: 'policy1',
                effect: 'allow',
                resources: { 'com.cloudflare.api.account.zone': 'zone123' },
                permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
              }],
            },
          },
        }))
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: { id: 'zone123', name: 'example.com', status: 'active' },
          },
        }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(true)
      expect(result.warnings.some(w => w.message.includes('Account ID not provided'))).toBe(true)
      expect(result.suggestions.some(s => s.includes('CLOUDFLARE_ACCOUNT_ID'))).toBe(true)
    })

    it('should handle insufficient account permissions', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
        accountId: 'account123',
      }

      // Mock successful token and zone verification
      mockFetch
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'token123',
              status: 'active',
              policies: [{
                id: 'policy1',
                effect: 'allow',
                resources: { 'com.cloudflare.api.account.zone': 'zone123' },
                permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
                // Missing account permissions
              }],
            },
          },
        }))
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: { id: 'zone123', name: 'example.com', status: 'active' },
          },
        }))

      // Mock account access denied
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: false,
        status: 403,
        jsonBody: {
          success: false,
          errors: [{ code: 10001, message: 'Insufficient permissions for account' }],
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Account not found or not accessible'))).toBe(true)
    })
  })

  describe('Permission Validation', () => {
    it('should validate required permissions for zone operations', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
      }

      const permissionScenarios = [
        {
          permissions: [{ id: 'zone_edit', name: 'Zone:Edit' }],
          shouldPass: true,
          description: 'with Zone:Edit permission',
        },
        {
          permissions: [{ id: 'zone_read', name: 'Zone:Read' }],
          shouldPass: false,
          description: 'with only Zone:Read permission',
        },
        {
          permissions: [],
          shouldPass: false,
          description: 'with no zone permissions',
        },
      ]

      for (const scenario of permissionScenarios) {
        // Mock token verification with specific permissions
        mockFetch.mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'token123',
              status: 'active',
              policies: [{
                id: 'policy1',
                effect: 'allow',
                resources: { 'com.cloudflare.api.account.zone': 'zone123' },
                permission_groups: scenario.permissions,
              }],
            },
          },
        }))

        // Mock zone info
        mockFetch.mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'zone123',
              name: 'example.com',
              status: 'active',
              permissions: scenario.permissions.map(p => p.id.replace('_', ':')),
            },
          },
        }))

        const result = await validator.validateCredentials(credentials)

        if (scenario.shouldPass) {
          expect(result.valid).toBe(true)
        } else {
          expect(result.valid).toBe(false)
          expect(result.errors.some(e => 
            e.message.includes('not accessible') || 
            e.message.includes('Insufficient permissions')
          )).toBe(true)
        }
      }
    })

    it('should validate Lists API permissions', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
        accountId: 'account123',
      }

      // Mock successful token and zone verification
      mockFetch
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'token123',
              status: 'active',
              policies: [{
                id: 'policy1',
                effect: 'allow',
                resources: {
                  'com.cloudflare.api.account.zone': 'zone123',
                  'com.cloudflare.api.account': 'account123',
                },
                permission_groups: [
                  { id: 'zone_edit', name: 'Zone:Edit' },
                  { id: 'account_read', name: 'Account:Read' },
                ],
              }],
            },
          },
        }))
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: { id: 'zone123', name: 'example.com', status: 'active' },
          },
        }))
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: { id: 'account123', name: 'Test Account' },
          },
        }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(true)
      expect(result.suggestions.some(s => s.includes('Lists API is available'))).toBe(true)
    })
  })

  describe('Edge Cases and Error Recovery', () => {
    it('should handle malformed API responses gracefully', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
      }

      // Mock malformed response
      mockFetch.mockResolvedValueOnce(makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          // Missing required fields
          data: 'invalid structure',
        },
      }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('Failed to verify API token'))).toBe(true)
    })

    it('should handle concurrent validation requests', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
      }

      // Mock successful responses for concurrent requests
      const mockSuccessResponse = makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: {
            id: 'token123',
            status: 'active',
            policies: [{
              id: 'policy1',
              effect: 'allow',
              resources: { 'com.cloudflare.api.account.zone': 'zone123' },
              permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
            }],
          },
        },
      })

      const mockZoneResponse = makeResponse({
        ok: true,
        status: 200,
        jsonBody: {
          success: true,
          result: { id: 'zone123', name: 'example.com', status: 'active' },
        },
      })

      // Mock multiple concurrent calls
      mockFetch
        .mockResolvedValue(mockSuccessResponse)
        .mockResolvedValue(mockZoneResponse)

      const promises = Array.from({ length: 3 }, () => validator.validateCredentials(credentials))
      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result.valid).toBe(true)
      })
    })

    it('should provide helpful suggestions for common issues', async () => {
      const credentials: CloudflareCredentials = {
        apiToken: 'valid-token-123456789012345678',
        zoneId: 'zone123',
      }

      // Mock token verification success but zone access failure
      mockFetch
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: {
              id: 'token123',
              status: 'active',
              policies: [{
                id: 'policy1',
                effect: 'allow',
                resources: { 'com.cloudflare.api.account.zone': 'other-zone' },
                permission_groups: [{ id: 'zone_edit', name: 'Zone:Edit' }],
              }],
            },
          },
        }))
        .mockResolvedValueOnce(makeResponse({
          ok: true,
          status: 200,
          jsonBody: {
            success: true,
            result: { id: 'zone123', name: 'example.com', status: 'active' },
          },
        }))

      const result = await validator.validateCredentials(credentials)

      expect(result.valid).toBe(false)
      expect(result.errors.some(e => 
        e.suggestion && e.suggestion.includes('Ensure the API token has permissions for this zone')
      )).toBe(true)
    })
  })
})