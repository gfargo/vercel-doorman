import { DoormanError } from '../../errors/DoormanError'
import { CloudflareErrorCode, ProviderErrorCode, NetworkErrorCode } from '../../errors/ErrorCodes'
import type { CloudflareAPIResponse } from '../../types/cloudflare'

/**
 * Cloudflare API error structure
 */
export interface CloudflareApiError {
  status: number
  code: number
  message: string
  details?: Record<string, unknown>
  endpoint?: string
}

/**
 * Enhanced error handler for Cloudflare-specific errors
 * Provides comprehensive error mapping with actionable suggestions and documentation links
 *
 * Features:
 * - Comprehensive HTTP status code mapping
 * - Specific Cloudflare error code handling
 * - User-friendly error messages with actionable suggestions
 * - Documentation links for troubleshooting
 * - Translation warning formatting
 * - Network error handling with retry suggestions
 */
export class CloudflareErrorHandler {
  private static readonly DOCS_BASE_URL = 'https://docs.doorman.griffen.codes/cloudflare'

  /**
   * Common error patterns and their suggested solutions
   */
  private static readonly ERROR_PATTERNS = {
    authentication: {
      keywords: ['authentication', 'token', 'unauthorized', 'invalid token'],
      suggestion: 'Verify your CLOUDFLARE_API_TOKEN is correct and has not expired. Create a new token if needed.',
      docsSection: 'setup#api-token',
    },
    permissions: {
      keywords: ['forbidden', 'access denied', 'insufficient permissions'],
      suggestion: 'Ensure your API token has the required permissions: Zone:Edit and Account:Read (for Lists API).',
      docsSection: 'setup#permissions',
    },
    rateLimit: {
      keywords: ['rate limit', 'too many requests', 'quota exceeded'],
      suggestion:
        'Wait before retrying or use --retry flag for automatic exponential backoff. Consider upgrading your plan.',
      docsSection: 'troubleshooting#rate-limits',
    },
    network: {
      keywords: ['timeout', 'connection', 'network', 'dns', 'enotfound', 'econnrefused'],
      suggestion: 'Check your internet connection and ensure api.cloudflare.com is accessible through your firewall.',
      docsSection: 'troubleshooting#connectivity',
    },
  }

  /**
   * Detect error context from message content for better error handling
   */
  private static detectErrorContext(message: string): {
    pattern: keyof typeof CloudflareErrorHandler.ERROR_PATTERNS | null
    confidence: number
  } {
    const lowerMessage = message.toLowerCase()
    let bestMatch: { pattern: keyof typeof CloudflareErrorHandler.ERROR_PATTERNS | null; confidence: number } = {
      pattern: null,
      confidence: 0,
    }

    for (const [pattern, config] of Object.entries(this.ERROR_PATTERNS)) {
      const matchCount = config.keywords.filter((keyword) => lowerMessage.includes(keyword)).length
      const confidence = matchCount / config.keywords.length

      if (confidence > bestMatch.confidence) {
        bestMatch = {
          pattern: pattern as keyof typeof CloudflareErrorHandler.ERROR_PATTERNS,
          confidence,
        }
      }
    }

    return bestMatch
  }

  /**
   * Handle Cloudflare API errors with comprehensive mapping
   * First tries to map specific Cloudflare error codes, then falls back to HTTP status codes
   */
  public static handleApiError(error: CloudflareApiError): DoormanError {
    // First, try to map specific Cloudflare error codes
    if (error.code && error.code !== 0) {
      const mappedError = this.mapCloudflareErrorCode(error)
      // If we got a specific mapping (not the generic API_ERROR), use it
      if (mappedError.code !== 'PROV_5002') {
        return mappedError
      }
    }

    // Fall back to HTTP status code mapping
    switch (error.status) {
      case 400:
        return this.handleBadRequestError(error)
      case 401:
        return this.handleUnauthorizedError(error)
      case 403:
        return this.handleForbiddenError(error)
      case 404:
        return this.handleNotFoundError(error)
      case 429:
        return this.handleRateLimitError(error)
      case 500:
      case 502:
      case 503:
      case 504:
        return this.handleServerError(error)
      default:
        return this.handleGenericError(error)
    }
  }

  /**
   * Handle Cloudflare API response errors
   */
  public static handleApiResponse<T>(response: CloudflareAPIResponse<T>, endpoint: string): DoormanError {
    if (response.success) {
      throw new Error('Cannot handle successful response as error')
    }

    const firstError = response.errors[0]
    const apiError: CloudflareApiError = {
      status: 0, // Will be determined by error code
      code: firstError?.code || 0,
      message: response.errors.map((e) => e.message).join(', '),
      endpoint,
      details: {
        errors: response.errors,
        messages: response.messages,
      },
    }

    // Map specific Cloudflare error codes first, then fall back to generic handling
    return this.mapCloudflareErrorCode(apiError)
  }

  /**
   * Handle credential validation errors
   */
  public static handleCredentialError(type: 'token' | 'zone' | 'account', value?: string): DoormanError {
    switch (type) {
      case 'token':
        return new DoormanError({
          code: ProviderErrorCode.INVALID_CREDENTIALS,
          message: 'Invalid or missing Cloudflare API token',
          suggestion:
            'Check your CLOUDFLARE_API_TOKEN environment variable or config file. Ensure the token has Zone:Edit and Account:Read permissions.',
          details: { credentialType: 'api_token' },
          docsUrl: `${this.DOCS_BASE_URL}/setup#api-token`,
        })

      case 'zone':
        return new DoormanError({
          code: CloudflareErrorCode.ZONE_ID_REQUIRED,
          message: value ? `Invalid zone ID: ${value}` : 'Missing zone ID',
          suggestion:
            'Provide a valid CLOUDFLARE_ZONE_ID. You can find this in your Cloudflare dashboard under the domain overview.',
          details: { zoneId: value, credentialType: 'zone_id' },
          docsUrl: `${this.DOCS_BASE_URL}/setup#zone-id`,
        })

      case 'account':
        return new DoormanError({
          code: CloudflareErrorCode.ACCOUNT_ID_REQUIRED,
          message: value ? `Invalid account ID: ${value}` : 'Missing account ID for Lists API',
          suggestion:
            'Provide CLOUDFLARE_ACCOUNT_ID to use Lists for IP blocking. This is optional but recommended for large IP lists.',
          details: { accountId: value, credentialType: 'account_id' },
          docsUrl: `${this.DOCS_BASE_URL}/setup#account-id`,
        })

      default:
        return new DoormanError({
          code: ProviderErrorCode.INVALID_CREDENTIALS,
          message: 'Invalid Cloudflare credentials',
          suggestion: 'Check your Cloudflare API credentials',
          docsUrl: `${this.DOCS_BASE_URL}/setup`,
        })
    }
  }

  /**
   * Handle configuration validation errors
   */
  public static handleValidationError(field: string, issue: string, value?: unknown): DoormanError {
    const fieldMappings: Record<string, { code: CloudflareErrorCode; suggestion: string; docsUrl: string }> = {
      rules: {
        code: CloudflareErrorCode.INVALID_RULESET,
        suggestion: 'Check your rule configuration syntax and ensure all required fields are present',
        docsUrl: `${this.DOCS_BASE_URL}/configuration#rules`,
      },
      expression: {
        code: CloudflareErrorCode.INVALID_EXPRESSION,
        suggestion: 'Use valid Cloudflare Wirefilter expression syntax. Check field names and operators.',
        docsUrl: `${this.DOCS_BASE_URL}/expressions`,
      },
      rateLimit: {
        code: CloudflareErrorCode.INVALID_RATE_LIMIT,
        suggestion: 'Rate limit requests must be at least 1, and window format should be like "60s", "1h", "1d"',
        docsUrl: `${this.DOCS_BASE_URL}/rate-limiting`,
      },
      redirect: {
        code: CloudflareErrorCode.REDIRECT_NO_LOCATION,
        suggestion: 'Redirect rules must include a valid location URL or path',
        docsUrl: `${this.DOCS_BASE_URL}/redirects`,
      },
      ip: {
        code: CloudflareErrorCode.INVALID_IP,
        suggestion: 'Use valid IPv4 or IPv6 address with optional CIDR notation (e.g., 192.168.1.1 or 192.168.1.0/24)',
        docsUrl: `${this.DOCS_BASE_URL}/ip-blocking`,
      },
    }

    const mapping = fieldMappings[field] || {
      code: CloudflareErrorCode.INVALID_RULESET,
      suggestion: 'Check your configuration syntax',
      docsUrl: `${this.DOCS_BASE_URL}/configuration`,
    }

    return new DoormanError({
      code: mapping.code,
      message: `Configuration validation failed for ${field}: ${issue}`,
      suggestion: mapping.suggestion,
      details: { field, issue, value },
      docsUrl: mapping.docsUrl,
    })
  }

  /**
   * Create enhanced error suggestions based on error context and operation
   */
  private static createEnhancedSuggestion(
    baseSuggestion: string,
    operation: string,
    errorContext?: { pattern: keyof typeof CloudflareErrorHandler.ERROR_PATTERNS | null; confidence: number },
  ): string {
    const suggestions = [baseSuggestion]

    // Add context-specific suggestions
    if (errorContext?.pattern && errorContext.confidence > 0.5) {
      const patternConfig = this.ERROR_PATTERNS[errorContext.pattern]
      suggestions.push(patternConfig.suggestion)
    }

    // Add operation-specific suggestions
    const operationSuggestions: Record<string, string> = {
      'syncing rules': 'Try running with --dry-run first to validate your configuration.',
      'fetching configuration': 'Verify your zone ID is correct and accessible.',
      'validating credentials': 'Double-check your API token permissions in the Cloudflare dashboard.',
      'creating ruleset': 'Ensure you have Zone:Edit permissions for the specified zone.',
      'updating rules': "Check if you have reached your plan's rule limit.",
    }

    const operationSuggestion = operationSuggestions[operation]
    if (operationSuggestion) {
      suggestions.push(operationSuggestion)
    }

    return suggestions.join(' ')
  }

  /**
   * Handle translation warnings with enhanced formatting and context
   */
  public static formatTranslationWarning(feature: string, sourceProvider: string, limitation: string): string {
    // Import the warning system
    const { TranslationWarningSystem } = require('../../translators/TranslationWarningSystem')

    // Try to create a specific warning based on the feature
    let warning
    try {
      warning = TranslationWarningSystem.createWarning(feature, undefined, undefined, limitation)
    } catch {
      // Fallback to creating a generic warning
      warning = TranslationWarningSystem.createLossyConversionWarning(
        feature,
        `${limitation} (from ${sourceProvider})`,
        undefined,
        undefined
      )
    }

    return TranslationWarningSystem.formatWarning(warning)
  }

  /**
   * Handle network and connectivity errors with enhanced context detection
   */
  public static handleNetworkError(error: Error, operation: string): DoormanError {
    const errorContext = this.detectErrorContext(error.message)

    if (error.message.includes('timeout')) {
      const suggestion = this.createEnhancedSuggestion(
        'Check your internet connection and try again. Use --retry flag for automatic retries.',
        operation,
        errorContext,
      )

      return new DoormanError({
        code: NetworkErrorCode.TIMEOUT,
        message: `Request timeout during ${operation}`,
        suggestion,
        details: {
          operation,
          originalError: error.message,
          retryRecommended: true,
          timeoutDuration: this.extractTimeoutDuration(error.message),
        },
        cause: error,
        docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#timeouts`,
      })
    }

    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      const suggestion = this.createEnhancedSuggestion(
        'Check your internet connection and firewall settings. Ensure api.cloudflare.com is accessible.',
        operation,
        errorContext,
      )

      return new DoormanError({
        code: NetworkErrorCode.CONNECTION_FAILED,
        message: `Network connection failed during ${operation}`,
        suggestion,
        details: {
          operation,
          originalError: error.message,
          dnsResolutionFailed: error.message.includes('ENOTFOUND'),
          connectionRefused: error.message.includes('ECONNREFUSED'),
        },
        cause: error,
        docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#connectivity`,
      })
    }

    const suggestion = this.createEnhancedSuggestion(
      'Check your internet connection and try again',
      operation,
      errorContext,
    )

    return new DoormanError({
      code: NetworkErrorCode.HTTP_ERROR,
      message: `Network error during ${operation}: ${error.message}`,
      suggestion,
      details: { operation, errorContext },
      cause: error,
      docsUrl: `${this.DOCS_BASE_URL}/troubleshooting`,
    })
  }

  /**
   * Extract timeout duration from error message for better context
   */
  private static extractTimeoutDuration(message: string): number | undefined {
    const timeoutMatch = message.match(/timeout.*?(\d+)(?:ms|s)/i)
    if (timeoutMatch && timeoutMatch[1]) {
      const value = parseInt(timeoutMatch[1], 10)
      const unit = message.toLowerCase().includes('ms') ? 1 : 1000
      return value * unit
    }
    return undefined
  }

  /**
   * Handle graceful degradation scenarios with clear messaging
   */
  public static handleGracefulDegradation(
    feature: string,
    reason: string,
    fallbackAction: string,
    impact?: string,
  ): DoormanError {
    const degradationMessages: Record<string, { code: CloudflareErrorCode; suggestion: string }> = {
      lists_api: {
        code: CloudflareErrorCode.ACCOUNT_ID_REQUIRED,
        suggestion: 'Provide CLOUDFLARE_ACCOUNT_ID to enable Lists API for better performance with large IP lists.',
      },
      managed_rules: {
        code: CloudflareErrorCode.FEATURE_UNSUPPORTED,
        suggestion: 'Use custom rules with equivalent conditions instead of managed rules.',
      },
      advanced_expressions: {
        code: CloudflareErrorCode.TRANSLATION_WARNING,
        suggestion: 'Simplify expressions to use supported Cloudflare Wirefilter syntax.',
      },
    }

    const config = degradationMessages[feature] || {
      code: CloudflareErrorCode.FEATURE_UNSUPPORTED,
      suggestion: 'Consider alternative approaches or manual configuration.',
    }

    return new DoormanError({
      code: config.code,
      message: `Feature degradation: ${feature} - ${reason}`,
      suggestion: `${config.suggestion} Fallback: ${fallbackAction}${impact ? ` Impact: ${impact}` : ''}`,
      details: {
        feature,
        reason,
        fallbackAction,
        impact,
        degradationType: 'graceful',
      },
      docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#feature-degradation`,
    })
  }

  /**
   * Create user-friendly error messages for common scenarios
   */
  public static createUserFriendlyMessage(
    operation: string,
    error: CloudflareApiError,
    context?: Record<string, unknown>,
  ): string {
    const baseMessage = `Failed to ${operation}`
    const contextInfo = context
      ? ` (${Object.entries(context)
          .map(([k, v]) => `${k}: ${v}`)
          .join(', ')})`
      : ''

    // Add specific guidance based on error type
    const guidanceMap: Record<number, string> = {
      401: 'Please check your API token in the Cloudflare dashboard.',
      403: 'Verify your API token has the required permissions.',
      404: 'The requested resource may have been deleted or moved.',
      429: 'You are being rate limited. Please wait before retrying.',
      500: 'Cloudflare is experiencing issues. Check their status page.',
    }

    const guidance = guidanceMap[error.status] || 'Please check your configuration and try again.'

    return `${baseMessage}${contextInfo}. ${guidance}`
  }

  /**
   * Handle 400 Bad Request errors
   */
  private static handleBadRequestError(error: CloudflareApiError): DoormanError {
    // Common bad request scenarios
    if (error.message.includes('expression')) {
      return new DoormanError({
        code: CloudflareErrorCode.INVALID_EXPRESSION,
        message: `Invalid Cloudflare expression: ${error.message}`,
        suggestion: 'Check your rule conditions and ensure they use valid Cloudflare Wirefilter syntax',
        details: error.details,
        docsUrl: `${this.DOCS_BASE_URL}/expressions`,
      })
    }

    if (error.message.includes('rule') && error.message.includes('condition')) {
      return new DoormanError({
        code: CloudflareErrorCode.RULE_NO_CONDITIONS,
        message: 'Rule validation failed: rules must have at least one condition',
        suggestion: 'Add conditions to your rule or remove empty rules from your configuration',
        details: error.details,
        docsUrl: `${this.DOCS_BASE_URL}/rules#conditions`,
      })
    }

    return new DoormanError({
      code: CloudflareErrorCode.INVALID_RULESET,
      message: `Invalid request: ${error.message}`,
      suggestion: 'Check your rule configuration for syntax errors and missing required fields',
      details: error.details,
      docsUrl: `${this.DOCS_BASE_URL}/configuration`,
    })
  }

  /**
   * Handle 401 Unauthorized errors
   */
  private static handleUnauthorizedError(error: CloudflareApiError): DoormanError {
    return new DoormanError({
      code: ProviderErrorCode.AUTH_FAILED,
      message: 'Authentication failed: Invalid API token',
      suggestion: "Check your CLOUDFLARE_API_TOKEN. Ensure it's valid and not expired. Create a new token if needed.",
      details: {
        endpoint: error.endpoint,
        hint: 'API tokens can be created at https://dash.cloudflare.com/profile/api-tokens',
      },
      docsUrl: `${this.DOCS_BASE_URL}/setup#api-token`,
    })
  }

  /**
   * Handle 403 Forbidden errors
   */
  private static handleForbiddenError(error: CloudflareApiError): DoormanError {
    if (error.endpoint?.includes('/accounts/')) {
      return new DoormanError({
        code: CloudflareErrorCode.ACCOUNT_ID_REQUIRED,
        message: 'Access denied: Invalid account ID or insufficient permissions',
        suggestion: 'Ensure your API token has Account:Read permissions and the account ID is correct',
        details: { endpoint: error.endpoint },
        docsUrl: `${this.DOCS_BASE_URL}/setup#permissions`,
      })
    }

    if (error.endpoint?.includes('/zones/')) {
      return new DoormanError({
        code: CloudflareErrorCode.ZONE_ID_REQUIRED,
        message: 'Access denied: Invalid zone ID or insufficient permissions',
        suggestion: 'Ensure your API token has Zone:Edit permissions and the zone ID is correct',
        details: { endpoint: error.endpoint },
        docsUrl: `${this.DOCS_BASE_URL}/setup#permissions`,
      })
    }

    return new DoormanError({
      code: ProviderErrorCode.AUTH_FAILED,
      message: 'Access denied: Insufficient permissions',
      suggestion: 'Ensure your API token has the required permissions: Zone:Edit and Account:Read (for Lists)',
      details: { endpoint: error.endpoint },
      docsUrl: `${this.DOCS_BASE_URL}/setup#permissions`,
    })
  }

  /**
   * Handle 404 Not Found errors
   */
  private static handleNotFoundError(error: CloudflareApiError): DoormanError {
    if (error.endpoint?.includes('/rulesets/')) {
      return new DoormanError({
        code: CloudflareErrorCode.RULESET_NOT_FOUND,
        message: 'Ruleset not found',
        suggestion: 'The ruleset may have been deleted. Try running the command again to create a new one.',
        details: { endpoint: error.endpoint },
        docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#ruleset-not-found`,
      })
    }

    if (error.endpoint?.includes('/lists/')) {
      return new DoormanError({
        code: CloudflareErrorCode.LIST_NOT_FOUND,
        message: 'List not found',
        suggestion: 'The IP list may have been deleted. Try running the command again to create a new one.',
        details: { endpoint: error.endpoint },
        docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#list-not-found`,
      })
    }

    if (error.endpoint?.includes('/zones/')) {
      return new DoormanError({
        code: CloudflareErrorCode.ZONE_ID_REQUIRED,
        message: 'Zone not found: Invalid zone ID',
        suggestion: 'Check your CLOUDFLARE_ZONE_ID. Find the correct zone ID in your Cloudflare dashboard.',
        details: { endpoint: error.endpoint },
        docsUrl: `${this.DOCS_BASE_URL}/setup#zone-id`,
      })
    }

    return new DoormanError({
      code: ProviderErrorCode.NOT_FOUND,
      message: `Resource not found: ${error.message}`,
      suggestion: 'Check that the resource exists and your credentials have access to it',
      details: { endpoint: error.endpoint },
      docsUrl: `${this.DOCS_BASE_URL}/troubleshooting`,
    })
  }

  /**
   * Handle 429 Rate Limit errors
   */
  private static handleRateLimitError(error: CloudflareApiError): DoormanError {
    const retryAfter = (error.details?.retryAfter as number) || 60

    return new DoormanError({
      code: ProviderErrorCode.RATE_LIMIT,
      message: 'Rate limit exceeded',
      suggestion: `Wait ${retryAfter} seconds and try again, or use --retry flag for automatic retries with exponential backoff`,
      details: {
        retryAfter,
        endpoint: error.endpoint,
        hint: 'Consider upgrading your Cloudflare plan for higher rate limits',
      },
      docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#rate-limits`,
    })
  }

  /**
   * Handle 5xx Server errors
   */
  private static handleServerError(error: CloudflareApiError): DoormanError {
    return new DoormanError({
      code: ProviderErrorCode.API_ERROR,
      message: `Cloudflare server error (${error.status}): ${error.message}`,
      suggestion:
        'This is a temporary Cloudflare issue. Wait a few minutes and try again, or check Cloudflare status page.',
      details: {
        status: error.status,
        endpoint: error.endpoint,
        statusPage: 'https://www.cloudflarestatus.com/',
      },
      docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#server-errors`,
    })
  }

  /**
   * Handle generic/unknown errors
   */
  private static handleGenericError(error: CloudflareApiError): DoormanError {
    return new DoormanError({
      code: ProviderErrorCode.API_ERROR,
      message: `Cloudflare API error (${error.status}): ${error.message}`,
      suggestion: 'Check the Cloudflare API documentation and your request parameters',
      details: {
        status: error.status,
        code: error.code,
        endpoint: error.endpoint,
      },
      docsUrl: `${this.DOCS_BASE_URL}/troubleshooting`,
    })
  }

  /**
   * Map specific Cloudflare error codes to appropriate errors
   */
  private static mapCloudflareErrorCode(error: CloudflareApiError): DoormanError {
    // Map common Cloudflare error codes
    switch (error.code) {
      case 10000: // Authentication error
        return this.handleUnauthorizedError(error)

      case 10001: // Authorization error
        return this.handleForbiddenError(error)

      case 10013: // Rate limit exceeded
        return this.handleRateLimitError(error)

      case 81044: // Ruleset not found
        return new DoormanError({
          code: CloudflareErrorCode.RULESET_NOT_FOUND,
          message: 'Ruleset not found',
          suggestion: 'The ruleset may have been deleted. Try running the command again to create a new one.',
          details: { cloudflareCode: error.code, endpoint: error.endpoint },
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#ruleset-not-found`,
        })

      case 81045: // Rule limit exceeded
        return new DoormanError({
          code: CloudflareErrorCode.RULE_LIMIT_EXCEEDED,
          message: 'Rule limit exceeded for your Cloudflare plan',
          suggestion: 'Consider consolidating rules, using Lists for IP blocking, or upgrading your Cloudflare plan',
          details: { cloudflareCode: error.code, endpoint: error.endpoint },
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#rule-limits`,
        })

      case 81046: // Invalid expression
        return new DoormanError({
          code: CloudflareErrorCode.INVALID_EXPRESSION,
          message: `Invalid Cloudflare expression: ${error.message}`,
          suggestion: 'Check your rule conditions and ensure they use valid Cloudflare Wirefilter syntax',
          details: { cloudflareCode: error.code, endpoint: error.endpoint },
          docsUrl: `${this.DOCS_BASE_URL}/expressions`,
        })

      case 1001: // Zone suspended
        return new DoormanError({
          code: CloudflareErrorCode.ZONE_SUSPENDED,
          message: 'Zone is suspended and cannot be modified',
          suggestion: 'Contact Cloudflare support to resolve zone suspension issues',
          details: { cloudflareCode: error.code, endpoint: error.endpoint },
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#zone-suspended`,
        })

      case 1014: // CNAME cross-user banned (plan limit)
      case 1015: // Rate limit exceeded (plan limit)
        return new DoormanError({
          code: CloudflareErrorCode.PLAN_LIMIT_EXCEEDED,
          message: `Plan limit exceeded: ${error.message}`,
          suggestion: 'Consider upgrading your Cloudflare plan for higher limits',
          details: { cloudflareCode: error.code, endpoint: error.endpoint },
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#plan-limits`,
        })

      case 1020: // Access denied (maintenance mode)
        return new DoormanError({
          code: CloudflareErrorCode.MAINTENANCE_MODE,
          message: 'Cloudflare service is currently in maintenance mode',
          suggestion: 'Wait for maintenance to complete and try again. Check Cloudflare status page.',
          details: {
            cloudflareCode: error.code,
            endpoint: error.endpoint,
            statusPage: 'https://www.cloudflarestatus.com/',
          },
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#maintenance`,
        })

      default:
        // For unknown error codes, determine handling based on message content or use generic handling
        const lowerMessage = error.message.toLowerCase()

        if (lowerMessage.includes('authentication') || lowerMessage.includes('invalid token')) {
          error.status = 401
          return this.handleUnauthorizedError(error)
        }
        if (lowerMessage.includes('forbidden') || lowerMessage.includes('access denied')) {
          error.status = 403
          return this.handleForbiddenError(error)
        }
        if (lowerMessage.includes('not found')) {
          error.status = 404
          return this.handleNotFoundError(error)
        }
        if (lowerMessage.includes('rate limit')) {
          error.status = 429
          return this.handleRateLimitError(error)
        }

        // Generic API error
        return new DoormanError({
          code: ProviderErrorCode.API_ERROR,
          message: `Cloudflare API error: ${error.message}`,
          suggestion: 'Check the Cloudflare API documentation and your request parameters',
          details: {
            cloudflareCode: error.code,
            endpoint: error.endpoint,
          },
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting`,
        })
    }
  }
}
