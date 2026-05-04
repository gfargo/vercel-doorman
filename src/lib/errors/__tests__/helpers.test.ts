jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { DoormanError } from '../DoormanError'
import {
    configErrors,
    providerErrors,
    cloudflareErrors,
    syncErrors,
    validationErrors,
    translationErrors,
    networkErrors,
} from '../helpers'
import {
    ConfigErrorCode,
    ProviderErrorCode,
    CloudflareErrorCode,
    SyncErrorCode,
    ValidationErrorCode,
    TranslationErrorCode,
    NetworkErrorCode,
} from '../ErrorCodes'

describe('error helpers', () => {
  describe('configErrors', () => {
    it('notFound creates error with correct code', () => {
      const err = configErrors.notFound('/path/to/config.json')
      expect(err).toBeInstanceOf(DoormanError)
      expect(err.code).toBe(ConfigErrorCode.NOT_FOUND)
      expect(err.message).toContain('/path/to/config.json')
    })

    it('parseError creates error with cause', () => {
      const cause = new Error('JSON parse error')
      const err = configErrors.parseError('/config.json', cause)
      expect(err.code).toBe(ConfigErrorCode.PARSE_ERROR)
      expect(err.cause).toBe(cause)
    })

    it('invalidVersion creates error with version details', () => {
      const err = configErrors.invalidVersion('1.0', '2.0')
      expect(err.code).toBe(ConfigErrorCode.INVALID_VERSION)
      expect(err.message).toContain('1.0')
    })

    it('invalidProvider creates error with supported list', () => {
      const err = configErrors.invalidProvider('aws', ['vercel', 'cloudflare'])
      expect(err.code).toBe(ConfigErrorCode.INVALID_PROVIDER)
      expect(err.message).toContain('aws')
      expect(err.suggestion).toContain('vercel')
    })
  })

  describe('providerErrors', () => {
    it('authFailed creates error with provider name', () => {
      const err = providerErrors.authFailed('vercel')
      expect(err.code).toBe(ProviderErrorCode.AUTH_FAILED)
      expect(err.message).toContain('vercel')
    })

    it('apiError creates error with status code', () => {
      const err = providerErrors.apiError('cloudflare', '/api/rules', 403, 'Forbidden')
      expect(err.code).toBe(ProviderErrorCode.API_ERROR)
      expect(err.message).toContain('403')
      expect(err.message).toContain('Forbidden')
    })

    it('rateLimit creates error with retry info', () => {
      const err = providerErrors.rateLimit('vercel', 30)
      expect(err.code).toBe(ProviderErrorCode.RATE_LIMIT)
      expect(err.suggestion).toContain('30')
    })

    it('rateLimit creates error without retry info', () => {
      const err = providerErrors.rateLimit('vercel')
      expect(err.code).toBe(ProviderErrorCode.RATE_LIMIT)
      expect(err.suggestion).toContain('Wait')
    })

    it('timeout creates error', () => {
      const err = providerErrors.timeout('cloudflare', 'fetchRules')
      expect(err.code).toBe(ProviderErrorCode.TIMEOUT)
    })

    it('invalidCredentials creates error with missing fields', () => {
      const err = providerErrors.invalidCredentials('vercel', ['token', 'projectId'])
      expect(err.code).toBe(ProviderErrorCode.INVALID_CREDENTIALS)
      expect(err.suggestion).toContain('token')
      expect(err.suggestion).toContain('projectId')
    })
  })

  describe('cloudflareErrors', () => {
    it('accountIdRequired creates error', () => {
      const err = cloudflareErrors.accountIdRequired('Lists API')
      expect(err.code).toBe(CloudflareErrorCode.ACCOUNT_ID_REQUIRED)
      expect(err.message).toContain('Lists API')
    })

    it('zoneIdRequired creates error', () => {
      const err = cloudflareErrors.zoneIdRequired('fetch rules')
      expect(err.code).toBe(CloudflareErrorCode.ZONE_ID_REQUIRED)
    })

    it('invalidCredentials creates error', () => {
      const err = cloudflareErrors.invalidCredentials('API token')
      expect(err.code).toBe(CloudflareErrorCode.INVALID_CREDENTIALS)
    })

    it('insufficientPermissions creates error', () => {
      const err = cloudflareErrors.insufficientPermissions('create rule', ['Zone.Firewall'])
      expect(err.code).toBe(CloudflareErrorCode.INSUFFICIENT_PERMISSIONS)
      expect(err.suggestion).toContain('Zone.Firewall')
    })

    it('ruleLimitExceeded creates error', () => {
      const err = cloudflareErrors.ruleLimitExceeded(150, 100)
      expect(err.code).toBe(CloudflareErrorCode.RULE_LIMIT_EXCEEDED)
      expect(err.message).toContain('150')
      expect(err.message).toContain('100')
    })

    it('invalidExpression creates error', () => {
      const err = cloudflareErrors.invalidExpression('bad expr', 'syntax error')
      expect(err.code).toBe(CloudflareErrorCode.INVALID_EXPRESSION)
    })

    it('ruleNoConditions creates error', () => {
      const err = cloudflareErrors.ruleNoConditions('My Rule')
      expect(err.code).toBe(CloudflareErrorCode.RULE_NO_CONDITIONS)
      expect(err.message).toContain('My Rule')
    })

    it('invalidRateLimit creates error', () => {
      const err = cloudflareErrors.invalidRateLimit('Rate Rule', 'window too short')
      expect(err.code).toBe(CloudflareErrorCode.INVALID_RATE_LIMIT)
    })

    it('invalidWindowFormat creates error', () => {
      const err = cloudflareErrors.invalidWindowFormat('abc')
      expect(err.code).toBe(CloudflareErrorCode.INVALID_WINDOW_FORMAT)
    })

    it('shortMitigationTimeout creates error', () => {
      const err = cloudflareErrors.shortMitigationTimeout(5)
      expect(err.code).toBe(CloudflareErrorCode.SHORT_MITIGATION_TIMEOUT)
    })

    it('redirectNoLocation creates error', () => {
      const err = cloudflareErrors.redirectNoLocation('Redirect Rule')
      expect(err.code).toBe(CloudflareErrorCode.REDIRECT_NO_LOCATION)
    })

    it('invalidRedirectUrl creates error', () => {
      const err = cloudflareErrors.invalidRedirectUrl('not-a-url')
      expect(err.code).toBe(CloudflareErrorCode.INVALID_REDIRECT_URL)
    })

    it('invalidIP creates error', () => {
      const err = cloudflareErrors.invalidIP('999.999.999.999')
      expect(err.code).toBe(CloudflareErrorCode.INVALID_IP)
    })

    it('largeIPList creates error', () => {
      const err = cloudflareErrors.largeIPList(5000)
      expect(err.code).toBe(CloudflareErrorCode.LARGE_IP_LIST)
    })

    it('rulesetNotFound creates error', () => {
      const err = cloudflareErrors.rulesetNotFound('rs-123')
      expect(err.code).toBe(CloudflareErrorCode.RULESET_NOT_FOUND)
      expect(err.message).toContain('rs-123')
    })

    it('rulesetNotFound creates error without id', () => {
      const err = cloudflareErrors.rulesetNotFound()
      expect(err.code).toBe(CloudflareErrorCode.RULESET_NOT_FOUND)
    })

    it('featureUnsupported creates error', () => {
      const err = cloudflareErrors.featureUnsupported('ja4_digest', 'vercel')
      expect(err.code).toBe(CloudflareErrorCode.FEATURE_UNSUPPORTED)
    })

    it('translationWarning creates error', () => {
      const err = cloudflareErrors.translationWarning('regex', 'limited support')
      expect(err.code).toBe(CloudflareErrorCode.TRANSLATION_WARNING)
    })
  })

  describe('syncErrors', () => {
    it('failed creates error', () => {
      const err = syncErrors.failed('vercel')
      expect(err.code).toBe(SyncErrorCode.FAILED)
    })

    it('noChanges creates error', () => {
      const err = syncErrors.noChanges()
      expect(err.code).toBe(SyncErrorCode.NO_CHANGES)
    })

    it('partialFailure creates error', () => {
      const err = syncErrors.partialFailure('cloudflare', 5, 2)
      expect(err.code).toBe(SyncErrorCode.PARTIAL_FAILURE)
      expect(err.message).toContain('5')
      expect(err.message).toContain('2')
    })
  })

  describe('validationErrors', () => {
    it('failed creates error with count', () => {
      const err = validationErrors.failed(3)
      expect(err.code).toBe(ValidationErrorCode.FAILED)
      expect(err.message).toContain('3')
    })

    it('schemaError creates error with path info', () => {
      const err = validationErrors.schemaError('rules[0].action', 'string', 'number')
      expect(err.code).toBe(ValidationErrorCode.SCHEMA_ERROR)
    })
  })

  describe('translationErrors', () => {
    it('unsupportedFeature creates error', () => {
      const err = translationErrors.unsupportedFeature('ja4_digest', 'vercel', 'cloudflare')
      expect(err.code).toBe(TranslationErrorCode.UNSUPPORTED_FEATURE)
      expect(err.message).toContain('ja4_digest')
    })

    it('expressionParseFailed creates error', () => {
      const err = translationErrors.expressionParseFailed('bad expression')
      expect(err.code).toBe(TranslationErrorCode.EXPRESSION_PARSE_FAILED)
    })
  })

  describe('networkErrors', () => {
    it('timeout creates error', () => {
      const err = networkErrors.timeout('https://api.vercel.com', 30000)
      expect(err.code).toBe(NetworkErrorCode.TIMEOUT)
      expect(err.message).toContain('30000')
    })

    it('connectionFailed creates error', () => {
      const err = networkErrors.connectionFailed('https://api.cloudflare.com')
      expect(err.code).toBe(NetworkErrorCode.CONNECTION_FAILED)
    })
  })

  describe('all errors have docsUrl', () => {
    it('config errors have docsUrl', () => {
      expect(configErrors.notFound('/test').docsUrl).toBeDefined()
    })

    it('provider errors have docsUrl', () => {
      expect(providerErrors.authFailed('vercel').docsUrl).toBeDefined()
    })

    it('cloudflare errors have docsUrl', () => {
      expect(cloudflareErrors.accountIdRequired('test').docsUrl).toBeDefined()
    })
  })
})
