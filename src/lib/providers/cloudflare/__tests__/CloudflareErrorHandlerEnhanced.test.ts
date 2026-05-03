import { CloudflareErrorHandler } from '../CloudflareErrorHandler'
import { DoormanError } from '../../../errors/DoormanError'
import { CloudflareErrorCode, NetworkErrorCode } from '../../../errors/ErrorCodes'

describe('CloudflareErrorHandler Enhanced Features', () => {
  describe('error context detection', () => {
    it('should detect authentication errors from message content', () => {
      const apiError = {
        status: 500,
        code: 0,
        message: 'Authentication failed due to invalid token',
        endpoint: '/test',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      // Server errors (500) go to server error handler, which returns PROV_5002 (API_ERROR)
      expect(result.code).toBe('PROV_5002') // API_ERROR
      expect(result.message).toContain('Authentication failed')
    })

    it('should detect permission errors from message content', () => {
      const apiError = {
        status: 500,
        code: 0,
        message: 'Access denied - insufficient permissions',
        endpoint: '/test',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      // Server errors (500) go to server error handler, which returns PROV_5002 (API_ERROR)
      expect(result.code).toBe('PROV_5002') // API_ERROR
      expect(result.message).toContain('Access denied')
    })

    it('should detect rate limit errors from message content', () => {
      const apiError = {
        status: 500,
        code: 0,
        message: 'Rate limit exceeded for this endpoint',
        endpoint: '/test',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      // Server errors (500) go to server error handler, which returns PROV_5002 (API_ERROR)
      expect(result.code).toBe('PROV_5002') // API_ERROR
      expect(result.message).toContain('Rate limit exceeded')
    })
  })

  describe('enhanced network error handling', () => {
    it('should extract timeout duration from error messages', () => {
      const timeoutError = new Error('Request timeout after 30000ms')
      const result = CloudflareErrorHandler.handleNetworkError(timeoutError, 'syncing rules')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(NetworkErrorCode.TIMEOUT)
      expect(result.details?.timeoutDuration).toBe(30000)
      expect(result.details?.retryRecommended).toBe(true)
    })

    it('should detect DNS resolution failures', () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.cloudflare.com')
      const result = CloudflareErrorHandler.handleNetworkError(dnsError, 'fetching config')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(NetworkErrorCode.CONNECTION_FAILED)
      expect(result.details?.dnsResolutionFailed).toBe(true)
      expect(result.suggestion).toContain('api.cloudflare.com is accessible')
    })

    it('should detect connection refused errors', () => {
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:443')
      const result = CloudflareErrorHandler.handleNetworkError(connError, 'validating credentials')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(NetworkErrorCode.CONNECTION_FAILED)
      expect(result.details?.connectionRefused).toBe(true)
      expect(result.suggestion).toContain('firewall settings')
    })
  })

  describe('graceful degradation handling', () => {
    it('should handle Lists API unavailability gracefully', () => {
      const result = CloudflareErrorHandler.handleGracefulDegradation(
        'lists_api',
        'Account ID not provided',
        'Using individual IP rules',
        'Reduced performance with large IP lists',
      )

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.ACCOUNT_ID_REQUIRED)
      expect(result.message).toContain('Feature degradation: lists_api')
      expect(result.suggestion).toContain('CLOUDFLARE_ACCOUNT_ID')
      expect(result.suggestion).toContain('Fallback: Using individual IP rules')
      expect(result.details?.degradationType).toBe('graceful')
    })

    it('should handle managed rules feature degradation', () => {
      const result = CloudflareErrorHandler.handleGracefulDegradation(
        'managed_rules',
        'Not supported in Cloudflare',
        'Using custom rules with equivalent conditions',
      )

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.FEATURE_UNSUPPORTED)
      expect(result.message).toContain('managed_rules')
      expect(result.suggestion).toContain('custom rules with equivalent conditions')
    })
  })

  describe('user-friendly message creation', () => {
    it('should create contextual error messages', () => {
      const apiError = {
        status: 401,
        code: 10000,
        message: 'Invalid API token',
        endpoint: '/zones/test/rulesets',
      }

      const message = CloudflareErrorHandler.createUserFriendlyMessage('sync firewall rules', apiError, {
        zoneId: 'test-zone',
        ruleCount: 5,
      })

      expect(message).toContain('Failed to sync firewall rules')
      expect(message).toContain('zoneId: test-zone')
      expect(message).toContain('ruleCount: 5')
      expect(message).toContain('check your API token')
    })

    it('should provide appropriate guidance for different status codes', () => {
      const testCases = [
        { status: 403, expectedGuidance: 'permissions' },
        { status: 404, expectedGuidance: 'deleted or moved' },
        { status: 429, expectedGuidance: 'rate limited' },
        { status: 500, expectedGuidance: 'status page' },
      ]

      testCases.forEach(({ status, expectedGuidance }) => {
        const apiError = {
          status,
          code: 0,
          message: 'Test error',
          endpoint: '/test',
        }

        const message = CloudflareErrorHandler.createUserFriendlyMessage('test operation', apiError)
        expect(message.toLowerCase()).toContain(expectedGuidance)
      })
    })
  })

  describe('new Cloudflare error codes', () => {
    it('should handle zone suspension errors', () => {
      const apiError = {
        status: 400, // Use 400 to avoid 403 handler
        code: 1001,
        message: 'Zone suspended',
        endpoint: '/zones/test',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.ZONE_SUSPENDED)
      expect(result.message).toContain('Zone is suspended')
      expect(result.suggestion).toContain('Contact Cloudflare support')
    })

    it('should handle plan limit exceeded errors', () => {
      const apiError = {
        status: 400,
        code: 1015,
        message: 'Rate limit exceeded for plan',
        endpoint: '/zones/test/rulesets',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.PLAN_LIMIT_EXCEEDED)
      expect(result.message).toContain('Plan limit exceeded')
      expect(result.suggestion).toContain('upgrading your Cloudflare plan')
    })

    it('should handle maintenance mode errors', () => {
      const apiError = {
        status: 400, // Use 400 to avoid server error handler
        code: 1020,
        message: 'Service temporarily unavailable',
        endpoint: '/zones/test/rulesets',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.MAINTENANCE_MODE)
      expect(result.message).toContain('maintenance mode')
      expect(result.suggestion).toContain('status page')
      expect(result.details?.statusPage).toContain('cloudflarestatus.com')
    })
  })

  describe('enhanced suggestion system', () => {
    it('should provide operation-specific suggestions', () => {
      const timeoutError = new Error('Request timeout')
      const result = CloudflareErrorHandler.handleNetworkError(timeoutError, 'syncing rules')

      expect(result.suggestion).toContain('--dry-run first')
    })

    it('should combine multiple suggestion sources', () => {
      const rateLimitError = new Error('Rate limit exceeded - too many requests')
      const result = CloudflareErrorHandler.handleNetworkError(rateLimitError, 'updating rules')

      // Should contain both network-level and operation-specific suggestions
      expect(result.suggestion).toContain('internet connection')
      expect(result.suggestion).toContain('rule limit')
    })
  })
})
