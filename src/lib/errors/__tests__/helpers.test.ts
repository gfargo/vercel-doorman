import { describe, it, expect } from '@jest/globals'
import {
  configErrors,
  providerErrors,
  cloudflareErrors,
  syncErrors,
  validationErrors,
  translationErrors,
  networkErrors,
} from '../helpers'
import { DoormanError } from '../DoormanError'
import {
  ConfigErrorCode,
  ProviderErrorCode,
  CloudflareErrorCode,
  SyncErrorCode,
  ValidationErrorCode,
  TranslationErrorCode,
  NetworkErrorCode,
} from '../ErrorCodes'

describe('Error Helpers', () => {
  describe('configErrors', () => {
    it('should create notFound error', () => {
      const error = configErrors.notFound('/path/to/config.json')

      expect(error).toBeInstanceOf(DoormanError)
      expect(error.code).toBe(ConfigErrorCode.NOT_FOUND)
      expect(error.message).toContain('/path/to/config.json')
      expect(error.suggestion).toBeDefined()
      expect(error.details).toHaveProperty('path')
    })

    it('should create parseError', () => {
      const cause = new Error('JSON parse error')
      const error = configErrors.parseError('/path/to/config.json', cause)

      expect(error.code).toBe(ConfigErrorCode.PARSE_ERROR)
      expect(error.cause).toBe(cause)
    })

    it('should create invalidVersion error', () => {
      const error = configErrors.invalidVersion('1.0', '2.0')

      expect(error.code).toBe(ConfigErrorCode.INVALID_VERSION)
      expect(error.message).toContain('1.0')
      expect(error.details).toHaveProperty('version', '1.0')
      expect(error.details).toHaveProperty('expected', '2.0')
    })

    it('should create invalidProvider error', () => {
      const error = configErrors.invalidProvider('custom', ['vercel', 'cloudflare'])

      expect(error.code).toBe(ConfigErrorCode.INVALID_PROVIDER)
      expect(error.message).toContain('custom')
      expect(error.suggestion).toContain('vercel')
      expect(error.suggestion).toContain('cloudflare')
    })
  })

  describe('providerErrors', () => {
    it('should create authFailed error', () => {
      const error = providerErrors.authFailed('cloudflare')

      expect(error.code).toBe(ProviderErrorCode.AUTH_FAILED)
      expect(error.message).toContain('cloudflare')
      expect(error.suggestion).toContain('credentials')
    })

    it('should create apiError', () => {
      const error = providerErrors.apiError('cloudflare', '/zones/123/rulesets', 403, 'Forbidden')

      expect(error.code).toBe(ProviderErrorCode.API_ERROR)
      expect(error.message).toContain('403')
      expect(error.message).toContain('Forbidden')
      expect(error.details).toHaveProperty('endpoint', '/zones/123/rulesets')
      expect(error.details).toHaveProperty('statusCode', 403)
    })

    it('should create rateLimit error with retry time', () => {
      const error = providerErrors.rateLimit('cloudflare', 60)

      expect(error.code).toBe(ProviderErrorCode.RATE_LIMIT)
      expect(error.suggestion).toContain('60 seconds')
      expect(error.details).toHaveProperty('retryAfter', 60)
    })

    it('should create rateLimit error without retry time', () => {
      const error = providerErrors.rateLimit('cloudflare')

      expect(error.code).toBe(ProviderErrorCode.RATE_LIMIT)
      expect(error.suggestion).toContain('Wait a few minutes')
    })

    it('should create timeout error', () => {
      const error = providerErrors.timeout('cloudflare', 'listRulesets')

      expect(error.code).toBe(ProviderErrorCode.TIMEOUT)
      expect(error.message).toContain('cloudflare')
      expect(error.message).toContain('listRulesets')
    })

    it('should create invalidCredentials error', () => {
      const error = providerErrors.invalidCredentials('cloudflare', ['apiToken', 'zoneId'])

      expect(error.code).toBe(ProviderErrorCode.INVALID_CREDENTIALS)
      expect(error.suggestion).toContain('apiToken')
      expect(error.suggestion).toContain('zoneId')
    })
  })

  describe('cloudflareErrors', () => {
    it('should create accountIdRequired error', () => {
      const error = cloudflareErrors.accountIdRequired('Lists API')

      expect(error.code).toBe(CloudflareErrorCode.ACCOUNT_ID_REQUIRED)
      expect(error.message).toContain('Lists API')
      expect(error.suggestion).toContain('CLOUDFLARE_ACCOUNT_ID')
    })

    it('should create ruleLimitExceeded error', () => {
      const error = cloudflareErrors.ruleLimitExceeded(150, 125)

      expect(error.code).toBe(CloudflareErrorCode.RULE_LIMIT_EXCEEDED)
      expect(error.message).toContain('150')
      expect(error.message).toContain('125')
      expect(error.suggestion).toBeDefined()
    })

    it('should create invalidExpression error', () => {
      const error = cloudflareErrors.invalidExpression('invalid expression', 'syntax error')

      expect(error.code).toBe(CloudflareErrorCode.INVALID_EXPRESSION)
      expect(error.details).toHaveProperty('expression', 'invalid expression')
      expect(error.details).toHaveProperty('reason', 'syntax error')
    })

    it('should create ruleNoConditions error', () => {
      const error = cloudflareErrors.ruleNoConditions('MyRule')

      expect(error.code).toBe(CloudflareErrorCode.RULE_NO_CONDITIONS)
      expect(error.message).toContain('MyRule')
    })

    it('should create invalidRateLimit error', () => {
      const error = cloudflareErrors.invalidRateLimit('MyRule', 'requests must be positive')

      expect(error.code).toBe(CloudflareErrorCode.INVALID_RATE_LIMIT)
      expect(error.message).toContain('MyRule')
      expect(error.message).toContain('requests must be positive')
    })

    it('should create redirectNoLocation error', () => {
      const error = cloudflareErrors.redirectNoLocation('MyRedirectRule')

      expect(error.code).toBe(CloudflareErrorCode.REDIRECT_NO_LOCATION)
      expect(error.message).toContain('MyRedirectRule')
      expect(error.suggestion).toContain('redirect.location')
    })

    it('should create invalidIP error', () => {
      const error = cloudflareErrors.invalidIP('invalid-ip')

      expect(error.code).toBe(CloudflareErrorCode.INVALID_IP)
      expect(error.message).toContain('invalid-ip')
      expect(error.suggestion).toContain('IPv4 or IPv6')
    })
  })

  describe('syncErrors', () => {
    it('should create failed error', () => {
      const error = syncErrors.failed('cloudflare')

      expect(error.code).toBe(SyncErrorCode.FAILED)
      expect(error.message).toContain('cloudflare')
    })

    it('should create noChanges error', () => {
      const error = syncErrors.noChanges()

      expect(error.code).toBe(SyncErrorCode.NO_CHANGES)
      expect(error.message).toContain('No changes')
    })

    it('should create partialFailure error', () => {
      const error = syncErrors.partialFailure('cloudflare', 5, 2)

      expect(error.code).toBe(SyncErrorCode.PARTIAL_FAILURE)
      expect(error.message).toContain('5')
      expect(error.message).toContain('2')
      expect(error.details).toHaveProperty('successful', 5)
      expect(error.details).toHaveProperty('failed', 2)
    })
  })

  describe('validationErrors', () => {
    it('should create failed error', () => {
      const error = validationErrors.failed(3)

      expect(error.code).toBe(ValidationErrorCode.FAILED)
      expect(error.message).toContain('3')
      expect(error.details).toHaveProperty('errorCount', 3)
    })

    it('should create schemaError', () => {
      const error = validationErrors.schemaError('/rules/0/action', 'string', 'number')

      expect(error.code).toBe(ValidationErrorCode.SCHEMA_ERROR)
      expect(error.message).toContain('/rules/0/action')
      expect(error.suggestion).toContain('string')
      expect(error.suggestion).toContain('number')
    })
  })

  describe('translationErrors', () => {
    it('should create unsupportedFeature error', () => {
      const error = translationErrors.unsupportedFeature('JA3 fingerprinting', 'vercel', 'cloudflare')

      expect(error.code).toBe(TranslationErrorCode.UNSUPPORTED_FEATURE)
      expect(error.message).toContain('JA3 fingerprinting')
      expect(error.message).toContain('vercel')
      expect(error.message).toContain('cloudflare')
    })

    it('should create expressionParseFailed error', () => {
      const cause = new Error('Parse error')
      const error = translationErrors.expressionParseFailed('invalid expression', cause)

      expect(error.code).toBe(TranslationErrorCode.EXPRESSION_PARSE_FAILED)
      expect(error.message).toContain('invalid expression')
      expect(error.cause).toBe(cause)
    })
  })

  describe('networkErrors', () => {
    it('should create timeout error', () => {
      const error = networkErrors.timeout('https://api.cloudflare.com/rulesets', 30000)

      expect(error.code).toBe(NetworkErrorCode.TIMEOUT)
      expect(error.message).toContain('30000ms')
      expect(error.details).toHaveProperty('url')
      expect(error.details).toHaveProperty('timeoutMs', 30000)
    })

    it('should create connectionFailed error', () => {
      const cause = new Error('ECONNREFUSED')
      const error = networkErrors.connectionFailed('https://api.cloudflare.com', cause)

      expect(error.code).toBe(NetworkErrorCode.CONNECTION_FAILED)
      expect(error.message).toContain('https://api.cloudflare.com')
      expect(error.cause).toBe(cause)
    })
  })

  describe('Error formatting consistency', () => {
    it('all error helpers should return DoormanError instances', () => {
      const errors = [
        configErrors.notFound('/path'),
        providerErrors.authFailed('cloudflare'),
        cloudflareErrors.accountIdRequired('Lists API'),
        syncErrors.failed('cloudflare'),
        validationErrors.failed(1),
        translationErrors.unsupportedFeature('feature', 'vercel', 'cloudflare'),
        networkErrors.timeout('https://api.com', 1000),
      ]

      errors.forEach((error) => {
        expect(error).toBeInstanceOf(DoormanError)
        expect(error.code).toBeDefined()
        expect(error.message).toBeDefined()
      })
    })

    it('all errors should have docs URLs', () => {
      const errors = [
        configErrors.notFound('/path'),
        providerErrors.authFailed('cloudflare'),
        cloudflareErrors.accountIdRequired('Lists API'),
        validationErrors.failed(1),
        translationErrors.unsupportedFeature('feature', 'vercel', 'cloudflare'),
        networkErrors.timeout('https://api.com', 1000),
      ]

      errors.forEach((error) => {
        expect(error.docsUrl).toBeDefined()
        expect(error.docsUrl).toContain('https://docs.doorman.griffen.codes/errors')
        expect(error.docsUrl).toContain(error.code)
      })
    })

    it('all errors should be formattable', () => {
      const error = configErrors.notFound('/path')

      const formatted = error.format()
      expect(formatted).toBeTruthy()
      expect(typeof formatted).toBe('string')

      const plainText = error.toPlainText()
      expect(plainText).toBeTruthy()
      expect(typeof plainText).toBe('string')
    })
  })
})
