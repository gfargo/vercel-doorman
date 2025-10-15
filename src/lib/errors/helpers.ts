import { DoormanError } from './DoormanError'
import {
  ConfigErrorCode,
  ValidationErrorCode,
  SyncErrorCode,
  ProviderErrorCode,
  CloudflareErrorCode,
  NetworkErrorCode,
  TranslationErrorCode,
} from './ErrorCodes'

const DOCS_BASE_URL = 'https://docs.doorman.griffen.codes/errors'

/**
 * Configuration error helpers
 */
export const configErrors = {
  notFound: (path: string) =>
    new DoormanError({
      code: ConfigErrorCode.NOT_FOUND,
      message: `Configuration file not found: ${path}`,
      suggestion: 'Run "vercel-doorman init" to create a new configuration file',
      details: { path },
      docsUrl: `${DOCS_BASE_URL}/${ConfigErrorCode.NOT_FOUND}`,
    }),

  parseError: (path: string, cause?: Error) =>
    new DoormanError({
      code: ConfigErrorCode.PARSE_ERROR,
      message: `Failed to parse configuration file: ${path}`,
      suggestion: 'Check that your configuration file is valid JSON',
      details: { path },
      cause,
      docsUrl: `${DOCS_BASE_URL}/${ConfigErrorCode.PARSE_ERROR}`,
    }),

  invalidVersion: (version: string, expected: string) =>
    new DoormanError({
      code: ConfigErrorCode.INVALID_VERSION,
      message: `Unsupported configuration version: ${version}`,
      suggestion: `Expected version ${expected}. Run migration to update your config`,
      details: { version, expected },
      docsUrl: `${DOCS_BASE_URL}/${ConfigErrorCode.INVALID_VERSION}`,
    }),

  invalidProvider: (provider: string, supported: string[]) =>
    new DoormanError({
      code: ConfigErrorCode.INVALID_PROVIDER,
      message: `Invalid provider: ${provider}`,
      suggestion: `Supported providers: ${supported.join(', ')}`,
      details: { provider, supported },
      docsUrl: `${DOCS_BASE_URL}/${ConfigErrorCode.INVALID_PROVIDER}`,
    }),
}

/**
 * Provider error helpers
 */
export const providerErrors = {
  authFailed: (provider: string, cause?: Error) =>
    new DoormanError({
      code: ProviderErrorCode.AUTH_FAILED,
      message: `Authentication failed for ${provider}`,
      suggestion: 'Check that your API credentials are valid and have the correct permissions',
      details: { provider },
      cause,
      docsUrl: `${DOCS_BASE_URL}/${ProviderErrorCode.AUTH_FAILED}`,
    }),

  apiError: (provider: string, endpoint: string, statusCode: number, message: string) =>
    new DoormanError({
      code: ProviderErrorCode.API_ERROR,
      message: `${provider} API error: ${statusCode} ${message}`,
      suggestion: 'Check the provider status page and your credentials',
      details: {
        provider,
        endpoint,
        statusCode,
        responseMessage: message,
      },
      docsUrl: `${DOCS_BASE_URL}/${ProviderErrorCode.API_ERROR}`,
    }),

  rateLimit: (provider: string, retryAfter?: number) =>
    new DoormanError({
      code: ProviderErrorCode.RATE_LIMIT,
      message: `Rate limit exceeded for ${provider}`,
      suggestion: retryAfter
        ? `Wait ${retryAfter} seconds and try again, or use --retry flag`
        : 'Wait a few minutes and try again, or use --retry flag',
      details: {
        provider,
        retryAfter,
      },
      docsUrl: `${DOCS_BASE_URL}/${ProviderErrorCode.RATE_LIMIT}`,
    }),

  timeout: (provider: string, operation: string) =>
    new DoormanError({
      code: ProviderErrorCode.TIMEOUT,
      message: `Request timeout for ${provider} ${operation}`,
      suggestion: 'Check your internet connection and try again',
      details: { provider, operation },
      docsUrl: `${DOCS_BASE_URL}/${ProviderErrorCode.TIMEOUT}`,
    }),

  invalidCredentials: (provider: string, missing: string[]) =>
    new DoormanError({
      code: ProviderErrorCode.INVALID_CREDENTIALS,
      message: `Missing or invalid credentials for ${provider}`,
      suggestion: `Please provide: ${missing.join(', ')}`,
      details: { provider, missing },
      docsUrl: `${DOCS_BASE_URL}/${ProviderErrorCode.INVALID_CREDENTIALS}`,
    }),
}

/**
 * Cloudflare-specific error helpers
 */
export const cloudflareErrors = {
  accountIdRequired: (operation: string) =>
    new DoormanError({
      code: CloudflareErrorCode.ACCOUNT_ID_REQUIRED,
      message: `Account ID required for ${operation}`,
      suggestion: 'Provide CLOUDFLARE_ACCOUNT_ID in your environment or configuration',
      details: { operation },
      docsUrl: `${DOCS_BASE_URL}/${CloudflareErrorCode.ACCOUNT_ID_REQUIRED}`,
    }),

  ruleLimitExceeded: (count: number, limit: number) =>
    new DoormanError({
      code: CloudflareErrorCode.RULE_LIMIT_EXCEEDED,
      message: `Rule count (${count}) exceeds Cloudflare limit (${limit})`,
      suggestion: 'Consider consolidating rules or using Lists for IP blocking',
      details: { count, limit },
      docsUrl: `${DOCS_BASE_URL}/${CloudflareErrorCode.RULE_LIMIT_EXCEEDED}`,
    }),

  invalidExpression: (expression: string, reason: string) =>
    new DoormanError({
      code: CloudflareErrorCode.INVALID_EXPRESSION,
      message: `Invalid Cloudflare expression: ${reason}`,
      suggestion: 'Check Cloudflare Wirefilter expression syntax',
      details: { expression, reason },
      docsUrl: `${DOCS_BASE_URL}/${CloudflareErrorCode.INVALID_EXPRESSION}`,
    }),

  ruleNoConditions: (ruleName: string) =>
    new DoormanError({
      code: CloudflareErrorCode.RULE_NO_CONDITIONS,
      message: `Rule "${ruleName}" has no conditions`,
      suggestion: 'Add at least one condition to the rule',
      details: { ruleName },
      docsUrl: `${DOCS_BASE_URL}/${CloudflareErrorCode.RULE_NO_CONDITIONS}`,
    }),

  invalidRateLimit: (ruleName: string, issue: string) =>
    new DoormanError({
      code: CloudflareErrorCode.INVALID_RATE_LIMIT,
      message: `Invalid rate limit configuration for rule "${ruleName}": ${issue}`,
      suggestion: 'Rate limit requests must be at least 1',
      details: { ruleName, issue },
      docsUrl: `${DOCS_BASE_URL}/${CloudflareErrorCode.INVALID_RATE_LIMIT}`,
    }),

  redirectNoLocation: (ruleName: string) =>
    new DoormanError({
      code: CloudflareErrorCode.REDIRECT_NO_LOCATION,
      message: `Redirect rule "${ruleName}" is missing location URL`,
      suggestion: 'Add a redirect.location property to the rule action',
      details: { ruleName },
      docsUrl: `${DOCS_BASE_URL}/${CloudflareErrorCode.REDIRECT_NO_LOCATION}`,
    }),

  invalidIP: (ip: string) =>
    new DoormanError({
      code: CloudflareErrorCode.INVALID_IP,
      message: `Invalid IP address format: ${ip}`,
      suggestion: 'Use valid IPv4 or IPv6 address (with optional CIDR notation)',
      details: { ip },
      docsUrl: `${DOCS_BASE_URL}/${CloudflareErrorCode.INVALID_IP}`,
    }),
}

/**
 * Sync error helpers
 */
export const syncErrors = {
  failed: (provider: string, cause?: Error) =>
    new DoormanError({
      code: SyncErrorCode.FAILED,
      message: `Failed to sync firewall rules to ${provider}`,
      suggestion: 'Check your credentials and network connection',
      details: { provider },
      cause,
      docsUrl: `${DOCS_BASE_URL}/${SyncErrorCode.FAILED}`,
    }),

  noChanges: () =>
    new DoormanError({
      code: SyncErrorCode.NO_CHANGES,
      message: 'No changes detected between local and remote configuration',
      suggestion: 'Your local configuration matches the remote state',
    }),

  partialFailure: (provider: string, successful: number, failed: number) =>
    new DoormanError({
      code: SyncErrorCode.PARTIAL_FAILURE,
      message: `Partial sync failure for ${provider}: ${successful} succeeded, ${failed} failed`,
      suggestion: 'Review the detailed error messages and retry failed operations',
      details: { provider, successful, failed },
      docsUrl: `${DOCS_BASE_URL}/${SyncErrorCode.PARTIAL_FAILURE}`,
    }),
}

/**
 * Validation error helpers
 */
export const validationErrors = {
  failed: (errorCount: number) =>
    new DoormanError({
      code: ValidationErrorCode.FAILED,
      message: `Configuration validation failed with ${errorCount} error(s)`,
      suggestion: 'Fix the validation errors and try again',
      details: { errorCount },
      docsUrl: `${DOCS_BASE_URL}/${ValidationErrorCode.FAILED}`,
    }),

  schemaError: (path: string, expected: string, actual: string) =>
    new DoormanError({
      code: ValidationErrorCode.SCHEMA_ERROR,
      message: `Schema validation error at ${path}`,
      suggestion: `Expected ${expected}, got ${actual}`,
      details: { path, expected, actual },
      docsUrl: `${DOCS_BASE_URL}/${ValidationErrorCode.SCHEMA_ERROR}`,
    }),
}

/**
 * Translation error helpers
 */
export const translationErrors = {
  unsupportedFeature: (feature: string, sourceProvider: string, targetProvider: string) =>
    new DoormanError({
      code: TranslationErrorCode.UNSUPPORTED_FEATURE,
      message: `Feature "${feature}" is not supported when translating from ${sourceProvider} to ${targetProvider}`,
      suggestion: 'Remove this feature or use a different provider',
      details: { feature, sourceProvider, targetProvider },
      docsUrl: `${DOCS_BASE_URL}/${TranslationErrorCode.UNSUPPORTED_FEATURE}`,
    }),

  expressionParseFailed: (expression: string, cause?: Error) =>
    new DoormanError({
      code: TranslationErrorCode.EXPRESSION_PARSE_FAILED,
      message: `Failed to parse expression: ${expression}`,
      suggestion: 'Check expression syntax and field names',
      details: { expression },
      cause,
      docsUrl: `${DOCS_BASE_URL}/${TranslationErrorCode.EXPRESSION_PARSE_FAILED}`,
    }),
}

/**
 * Network error helpers
 */
export const networkErrors = {
  timeout: (url: string, timeoutMs: number) =>
    new DoormanError({
      code: NetworkErrorCode.TIMEOUT,
      message: `Request timed out after ${timeoutMs}ms`,
      suggestion: 'Check your internet connection and try again',
      details: { url, timeoutMs },
      docsUrl: `${DOCS_BASE_URL}/${NetworkErrorCode.TIMEOUT}`,
    }),

  connectionFailed: (url: string, cause?: Error) =>
    new DoormanError({
      code: NetworkErrorCode.CONNECTION_FAILED,
      message: `Failed to connect to ${url}`,
      suggestion: 'Check your internet connection and firewall settings',
      details: { url },
      cause,
      docsUrl: `${DOCS_BASE_URL}/${NetworkErrorCode.CONNECTION_FAILED}`,
    }),
}
