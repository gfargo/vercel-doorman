import { CloudflareErrorHandler } from '../CloudflareErrorHandler'
import { DoormanError } from '../../../errors/DoormanError'
import { CloudflareErrorCode, ProviderErrorCode, NetworkErrorCode } from '../../../errors/ErrorCodes'
import type { CloudflareAPIResponse } from '../../../types/cloudflare'

describe('CloudflareErrorHandler', () => {
  describe('handleApiError', () => {
    it('should handle 401 unauthorized errors', () => {
      const apiError = {
        status: 401,
        code: 10000,
        message: 'Invalid API token',
        endpoint: '/zones/test/rulesets',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(ProviderErrorCode.AUTH_FAILED)
      expect(result.message).toContain('Authentication failed')
      expect(result.suggestion).toContain('CLOUDFLARE_API_TOKEN')
      expect(result.docsUrl).toContain('cloudflare/setup#api-token')
    })

    it('should handle 403 forbidden errors for zone access', () => {
      const apiError = {
        status: 403,
        code: 10001,
        message: 'Access denied',
        endpoint: '/zones/invalid-zone/rulesets',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.ZONE_ID_REQUIRED)
      expect(result.message).toContain('Invalid zone ID')
      expect(result.suggestion).toContain('Zone:Edit permissions')
    })

    it('should handle 403 forbidden errors for account access', () => {
      const apiError = {
        status: 403,
        code: 10001,
        message: 'Access denied',
        endpoint: '/accounts/invalid-account/rules/lists',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.ACCOUNT_ID_REQUIRED)
      expect(result.message).toContain('Invalid account ID')
      expect(result.suggestion).toContain('Account:Read permissions')
    })

    it('should handle 404 not found errors for rulesets', () => {
      const apiError = {
        status: 404,
        code: 81044,
        message: 'Ruleset not found',
        endpoint: '/zones/test/rulesets/missing-ruleset',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.RULESET_NOT_FOUND)
      expect(result.message).toContain('Ruleset not found')
      expect(result.suggestion).toContain('create a new one')
    })

    it('should handle 429 rate limit errors', () => {
      const apiError = {
        status: 429,
        code: 10013,
        message: 'Rate limit exceeded',
        endpoint: '/zones/test/rulesets',
        details: { retryAfter: 120 },
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(ProviderErrorCode.RATE_LIMIT)
      expect(result.message).toContain('Rate limit exceeded')
      expect(result.suggestion).toContain('120 seconds')
      expect(result.suggestion).toContain('--retry flag')
    })

    it('should handle 400 bad request errors with invalid expressions', () => {
      const apiError = {
        status: 400,
        code: 81046,
        message: 'Invalid expression syntax',
        endpoint: '/zones/test/rulesets',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.INVALID_EXPRESSION)
      expect(result.message).toContain('Invalid Cloudflare expression')
      expect(result.suggestion).toContain('Wirefilter syntax')
    })

    it('should handle 500 server errors', () => {
      const apiError = {
        status: 500,
        code: 0,
        message: 'Internal server error',
        endpoint: '/zones/test/rulesets',
      }

      const result = CloudflareErrorHandler.handleApiError(apiError)

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(ProviderErrorCode.API_ERROR)
      expect(result.message).toContain('Cloudflare server error')
      expect(result.suggestion).toContain('temporary')
      expect(result.details?.statusPage).toContain('cloudflarestatus.com')
    })
  })

  describe('handleApiResponse', () => {
    it('should handle failed API responses', () => {
      const response: CloudflareAPIResponse<any> = {
        success: false,
        errors: [
          { code: 10000, message: 'Authentication failed' },
          { code: 10001, message: 'Invalid token format' },
        ],
        messages: [],
        result: null,
      }

      const result = CloudflareErrorHandler.handleApiResponse(response, '/test/endpoint')

      expect(result).toBeInstanceOf(DoormanError)
      // The error handler maps code 10000 to unauthorized error, so it uses that message
      expect(result.message).toContain('Authentication failed')
      expect(result.details?.endpoint).toBe('/test/endpoint')
    })

    it('should throw error for successful responses', () => {
      const response: CloudflareAPIResponse<any> = {
        success: true,
        errors: [],
        messages: [],
        result: {},
      }

      expect(() => {
        CloudflareErrorHandler.handleApiResponse(response, '/test/endpoint')
      }).toThrow('Cannot handle successful response as error')
    })
  })

  describe('handleCredentialError', () => {
    it('should handle invalid API token errors', () => {
      const result = CloudflareErrorHandler.handleCredentialError('token')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(ProviderErrorCode.INVALID_CREDENTIALS)
      expect(result.message).toContain('Invalid or missing Cloudflare API token')
      expect(result.suggestion).toContain('CLOUDFLARE_API_TOKEN')
      expect(result.suggestion).toContain('Zone:Edit and Account:Read permissions')
    })

    it('should handle invalid zone ID errors', () => {
      const result = CloudflareErrorHandler.handleCredentialError('zone', 'invalid-zone-id')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.ZONE_ID_REQUIRED)
      expect(result.message).toContain('Invalid zone ID: invalid-zone-id')
      expect(result.suggestion).toContain('CLOUDFLARE_ZONE_ID')
      expect(result.details?.zoneId).toBe('invalid-zone-id')
    })

    it('should handle missing account ID errors', () => {
      const result = CloudflareErrorHandler.handleCredentialError('account')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.ACCOUNT_ID_REQUIRED)
      expect(result.message).toContain('Missing account ID for Lists API')
      expect(result.suggestion).toContain('CLOUDFLARE_ACCOUNT_ID')
      expect(result.suggestion).toContain('optional but recommended')
    })
  })

  describe('handleValidationError', () => {
    it('should handle rule validation errors', () => {
      const result = CloudflareErrorHandler.handleValidationError('rules', 'missing required field', {
        field: 'action',
      })

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.INVALID_RULESET)
      expect(result.message).toContain('Configuration validation failed for rules')
      expect(result.details?.field).toBe('rules')
      expect(result.details?.value).toEqual({ field: 'action' })
    })

    it('should handle expression validation errors', () => {
      const result = CloudflareErrorHandler.handleValidationError('expression', 'invalid syntax', 'ip.src eq')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.INVALID_EXPRESSION)
      expect(result.message).toContain('Configuration validation failed for expression')
      expect(result.suggestion).toContain('Wirefilter expression syntax')
    })

    it('should handle IP validation errors', () => {
      const result = CloudflareErrorHandler.handleValidationError('ip', 'invalid format', '999.999.999.999')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(CloudflareErrorCode.INVALID_IP)
      expect(result.message).toContain('Configuration validation failed for ip')
      expect(result.suggestion).toContain('IPv4 or IPv6 address')
    })
  })

  describe('formatTranslationWarning', () => {
    it('should format translation warnings with comprehensive details', () => {
      const result = CloudflareErrorHandler.formatTranslationWarning(
        'managed_rules',
        'vercel',
        'not directly supported',
      )

      expect(result).toContain('🚨 CRITICAL:')
      expect(result).toContain('not directly supported')
      expect(result).toContain('💡 Suggestion:')
      expect(result).toContain('🔄 Alternative:')
      expect(result).toContain('📊 Impact:')
      expect(result).toContain('📖 Documentation:')
      expect(result).toContain('Managed rules are provider-specific')
    })

    it('should handle unknown features with fallback warning', () => {
      const result = CloudflareErrorHandler.formatTranslationWarning('unknown_feature', 'vercel', 'not supported')

      expect(result).toContain('⚠️ WARNING:')
      expect(result).toContain('not supported')
      expect(result).toContain('💡 Suggestion:')
      expect(result).toContain('Review the translated configuration')
    })

    it('should format warnings for different feature types', () => {
      const geoResult = CloudflareErrorHandler.formatTranslationWarning(
        'geo_blocking',
        'vercel',
        'country code differences',
      )

      expect(geoResult).toContain('⚠️ WARNING:')
      expect(geoResult).toContain('country code differences')
      expect(geoResult).toContain('ISO country codes')
      expect(geoResult).toContain('Geographic blocking may use different')
    })
  })

  describe('handleNetworkError', () => {
    it('should handle timeout errors', () => {
      const timeoutError = new Error('Request timeout after 30000ms')
      const result = CloudflareErrorHandler.handleNetworkError(timeoutError, 'syncing rules')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(NetworkErrorCode.TIMEOUT)
      expect(result.message).toContain('Request timeout during syncing rules')
      expect(result.suggestion).toContain('internet connection')
      expect(result.suggestion).toContain('--retry flag')
      expect(result.cause).toBe(timeoutError)
    })

    it('should handle DNS resolution errors', () => {
      const dnsError = new Error('getaddrinfo ENOTFOUND api.cloudflare.com')
      const result = CloudflareErrorHandler.handleNetworkError(dnsError, 'fetching rulesets')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(NetworkErrorCode.CONNECTION_FAILED)
      expect(result.message).toContain('Network connection failed during fetching rulesets')
      expect(result.suggestion).toContain('api.cloudflare.com is accessible')
      expect(result.cause).toBe(dnsError)
    })

    it('should handle connection refused errors', () => {
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:443')
      const result = CloudflareErrorHandler.handleNetworkError(connError, 'validating credentials')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(NetworkErrorCode.CONNECTION_FAILED)
      expect(result.message).toContain('Network connection failed during validating credentials')
      expect(result.suggestion).toContain('firewall settings')
    })

    it('should handle generic network errors', () => {
      const genericError = new Error('Something went wrong with the network')
      const result = CloudflareErrorHandler.handleNetworkError(genericError, 'unknown operation')

      expect(result).toBeInstanceOf(DoormanError)
      expect(result.code).toBe(NetworkErrorCode.HTTP_ERROR)
      expect(result.message).toContain('Network error during unknown operation')
      expect(result.cause).toBe(genericError)
    })
  })

  describe('mapCloudflareErrorCode', () => {
    it('should map specific Cloudflare error codes', () => {
      const response: CloudflareAPIResponse<any> = {
        success: false,
        errors: [{ code: 81045, message: 'Rule limit exceeded' }],
        messages: [],
        result: null,
      }

      // Test through handleApiResponse to ensure proper mapping
      const result = CloudflareErrorHandler.handleApiResponse(response, '/zones/test/rulesets')

      expect(result.code).toBe(CloudflareErrorCode.RULE_LIMIT_EXCEEDED)
      expect(result.message).toContain('Rule limit exceeded')
      expect(result.suggestion).toContain('consolidating rules')
    })
  })
})
