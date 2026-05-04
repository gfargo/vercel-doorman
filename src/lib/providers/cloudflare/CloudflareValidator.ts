import { logger } from '../../logger'
import { CloudflareClient } from './CloudflareClient'
import { CloudflareErrorHandler } from './CloudflareErrorHandler'
import { DoormanError } from '../../errors/DoormanError'
import { ProviderErrorCode } from '../../errors/ErrorCodes'
import type { CloudflareAPIResponse } from '../../types/cloudflare'

/**
 * Cloudflare credentials interface
 */
export interface CloudflareCredentials {
  apiToken: string
  zoneId: string
  accountId?: string
}

/**
 * Validation error interface
 */
export interface ValidationError {
  field: string
  message: string
  suggestion: string
  docsUrl?: string
}

/**
 * Validation warning interface
 */
export interface ValidationWarning {
  field: string
  message: string
  impact: string
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: string[]
}

/**
 * Zone information interface
 */
interface ZoneInfo {
  id: string
  name: string
  status: string
  permissions: string[]
}

/**
 * Account information interface
 */
interface AccountInfo {
  id: string
  name: string
  permissions: string[]
}

/**
 * Token verification result interface
 */
interface TokenVerificationResult {
  valid: boolean
  permissions: string[]
  zones: string[]
  accounts: string[]
}

/**
 * CloudflareValidator service
 * Provides comprehensive validation for Cloudflare credentials and configuration
 *
 * Features:
 * - API token validity checking with permission verification
 * - Zone ID validation with actual API calls to verify access
 * - Account ID validation for Lists API availability
 * - Permission checking to ensure required API access levels
 * - Detailed error reporting with actionable suggestions
 */
export class CloudflareValidator {
  private readonly DOCS_BASE_URL = 'https://docs.doorman.griffen.codes/cloudflare'

  /**
   * Validate Cloudflare credentials comprehensively
   * Checks API token validity, zone access, and account access if provided
   */
  public async validateCredentials(credentials: CloudflareCredentials): Promise<ValidationResult> {
    logger.debug('Starting comprehensive Cloudflare credential validation')

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    }

    try {
      // Step 1: Validate API token format and basic structure
      const tokenFormatResult = this.validateTokenFormat(credentials.apiToken)
      if (!tokenFormatResult.valid) {
        result.errors.push(...tokenFormatResult.errors)
        result.valid = false
      }

      // Step 2: Verify token with Cloudflare API
      let tokenVerification: TokenVerificationResult | null = null
      try {
        tokenVerification = await this.verifyTokenWithAPI(credentials.apiToken)
        if (!tokenVerification.valid) {
          result.errors.push({
            field: 'apiToken',
            message: 'API token is invalid or expired',
            suggestion: 'Create a new API token with the required permissions in the Cloudflare dashboard',
            docsUrl: `${this.DOCS_BASE_URL}/setup#api-token`,
          })
          result.valid = false
        }
      } catch (error) {
        result.errors.push({
          field: 'apiToken',
          message: `Failed to verify API token: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestion: 'Check your internet connection and ensure the API token is correct',
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#connectivity`,
        })
        result.valid = false
      }

      // Step 3: Validate zone ID and access
      if (tokenVerification?.valid) {
        const zoneValidation = await this.validateZoneAccess(credentials.zoneId, credentials.apiToken)
        if (!zoneValidation.valid) {
          result.errors.push(...zoneValidation.errors)
          result.warnings.push(...zoneValidation.warnings)
          result.valid = false
        } else {
          // Check if zone is in the token's accessible zones
          if (!tokenVerification.zones.includes(credentials.zoneId)) {
            result.errors.push({
              field: 'zoneId',
              message: 'Zone ID is not accessible with the provided API token',
              suggestion: 'Ensure the API token has permissions for this zone, or check the zone ID is correct',
              docsUrl: `${this.DOCS_BASE_URL}/setup#zone-id`,
            })
            result.valid = false
          }
        }
      }

      // Step 4: Validate account ID if provided
      if (credentials.accountId && tokenVerification?.valid) {
        const accountValidation = await this.validateAccountAccess(credentials.accountId, credentials.apiToken)
        if (!accountValidation.valid) {
          result.errors.push(...accountValidation.errors)
          result.warnings.push(...accountValidation.warnings)
          // Account ID is optional, so don't mark overall validation as failed
          result.warnings.push({
            field: 'accountId',
            message: 'Account ID validation failed - Lists API will not be available',
            impact:
              'IP blocking will use individual rules instead of Lists, which may be less efficient for large IP lists',
          })
        } else {
          // Check if account is in the token's accessible accounts
          if (!tokenVerification.accounts.includes(credentials.accountId)) {
            result.warnings.push({
              field: 'accountId',
              message: 'Account ID is not accessible with the provided API token',
              impact: 'Lists API will not be available for IP blocking',
            })
          }
        }
      } else if (!credentials.accountId) {
        result.warnings.push({
          field: 'accountId',
          message: 'Account ID not provided',
          impact:
            'Lists API will not be available - IP blocking will use individual rules which may be less efficient for large lists',
        })
        result.suggestions.push('Consider providing CLOUDFLARE_ACCOUNT_ID for better performance with large IP lists')
      }

      // Step 5: Check permissions
      if (tokenVerification?.valid) {
        const permissionCheck = this.checkRequiredPermissions(tokenVerification.permissions)
        if (!permissionCheck.valid) {
          result.errors.push(...permissionCheck.errors)
          result.warnings.push(...permissionCheck.warnings)
          result.valid = false
        }
      }

      // Add general suggestions based on validation results
      if (result.valid) {
        result.suggestions.push('All credentials are valid and properly configured')
        if (!credentials.accountId) {
          result.suggestions.push('Consider adding CLOUDFLARE_ACCOUNT_ID to enable Lists API for better performance')
        }
      } else {
        result.suggestions.push('Fix the credential errors above before proceeding')
        result.suggestions.push('Refer to the setup documentation for detailed instructions')
      }

      logger.debug(`Credential validation completed: ${result.valid ? 'PASSED' : 'FAILED'}`)
      return result
    } catch (error) {
      logger.error(`Credential validation failed with unexpected error: ${error}`)

      result.valid = false
      result.errors.push({
        field: 'general',
        message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        suggestion: 'Check your internet connection and try again',
        docsUrl: `${this.DOCS_BASE_URL}/troubleshooting`,
      })

      return result
    }
  }

  /**
   * Validate zone access with actual API calls
   * Verifies that the zone exists and is accessible with the provided token
   */
  public async validateZoneAccess(zoneId: string, token: string): Promise<ValidationResult> {
    logger.debug(`Validating zone access for zone: ${zoneId}`)

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    }

    try {
      const client = new CloudflareClient(token, zoneId)

      // Try to get zone information
      const zoneInfo = await this.getZoneInfo(token, zoneId)

      if (!zoneInfo) {
        result.valid = false
        result.errors.push({
          field: 'zoneId',
          message: 'Zone not found or not accessible',
          suggestion: 'Check that the zone ID is correct and the API token has access to this zone',
          docsUrl: `${this.DOCS_BASE_URL}/setup#zone-id`,
        })
        return result
      }

      // Check zone status
      if (zoneInfo.status !== 'active') {
        result.warnings.push({
          field: 'zoneId',
          message: `Zone status is '${zoneInfo.status}' instead of 'active'`,
          impact: 'Some operations may not work correctly if the zone is not active',
        })

        if (zoneInfo.status === 'pending') {
          result.suggestions.push('Complete the zone setup in Cloudflare dashboard to activate the zone')
        }
      }

      // Try to list rulesets to verify write access
      try {
        await client.listRulesets()
        logger.debug('Zone write access verified successfully')
      } catch (error) {
        // Check if it's a permission-related error
        const isPermissionError =
          error instanceof Error &&
          ((error as any).code === ProviderErrorCode.AUTH_FAILED ||
            error.message.toLowerCase().includes('insufficient permissions') ||
            error.message.toLowerCase().includes('forbidden') ||
            error.message.toLowerCase().includes('access denied'))

        if (isPermissionError) {
          result.errors.push({
            field: 'zoneId',
            message: 'Insufficient permissions for zone operations',
            suggestion: 'Ensure your API token has Zone:Edit permissions for this zone',
            docsUrl: `${this.DOCS_BASE_URL}/setup#permissions`,
          })
          result.valid = false
        } else {
          // Other errors might be temporary
          result.warnings.push({
            field: 'zoneId',
            message: `Could not verify zone write access: ${error instanceof Error ? error.message : 'Unknown error'}`,
            impact: 'Zone operations may fail during actual usage',
          })
        }
      }

      logger.debug(`Zone validation completed for ${zoneId}: ${result.valid ? 'PASSED' : 'FAILED'}`)
      return result
    } catch (error) {
      logger.error(`Zone validation failed: ${error}`)

      result.valid = false

      if (error instanceof DoormanError) {
        result.errors.push({
          field: 'zoneId',
          message: error.message,
          suggestion: error.suggestion || 'Check the zone ID and API token permissions',
          docsUrl: error.docsUrl || `${this.DOCS_BASE_URL}/setup#zone-id`,
        })
      } else {
        result.errors.push({
          field: 'zoneId',
          message: `Zone validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestion: 'Check your internet connection and zone configuration',
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting`,
        })
      }

      return result
    }
  }

  /**
   * Validate account access for Lists API availability
   * Verifies that the account exists and is accessible with the provided token
   */
  public async validateAccountAccess(accountId: string, token: string): Promise<ValidationResult> {
    logger.debug(`Validating account access for account: ${accountId}`)

    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    }

    try {
      // Try to get account information
      const accountInfo = await this.getAccountInfo(token, accountId)

      if (!accountInfo) {
        result.valid = false
        result.errors.push({
          field: 'accountId',
          message: 'Account not found or not accessible',
          suggestion: 'Check that the account ID is correct and the API token has access to this account',
          docsUrl: `${this.DOCS_BASE_URL}/setup#account-id`,
        })
        return result
      }

      // Try to access Lists API to verify it's available
      try {
        const client = new CloudflareClient(token, 'dummy-zone', accountId)
        await client.listLists()
        logger.debug('Lists API access verified successfully')

        result.suggestions.push('Lists API is available and can be used for efficient IP blocking')
      } catch (error) {
        // Check if it's a permission-related error
        const isPermissionError =
          error instanceof Error &&
          ((error as any).code === ProviderErrorCode.AUTH_FAILED ||
            error.message.toLowerCase().includes('insufficient permissions') ||
            error.message.toLowerCase().includes('forbidden') ||
            error.message.toLowerCase().includes('access denied'))

        if (isPermissionError) {
          result.errors.push({
            field: 'accountId',
            message: 'Insufficient permissions for Lists API',
            suggestion: 'Ensure your API token has Account:Read permissions',
            docsUrl: `${this.DOCS_BASE_URL}/setup#permissions`,
          })
          result.valid = false
        } else {
          // Other errors might be temporary or plan-related
          result.warnings.push({
            field: 'accountId',
            message: `Could not verify Lists API access: ${error instanceof Error ? error.message : 'Unknown error'}`,
            impact: 'Lists API may not be available, falling back to individual IP rules',
          })
        }
      }

      logger.debug(`Account validation completed for ${accountId}: ${result.valid ? 'PASSED' : 'FAILED'}`)
      return result
    } catch (error) {
      logger.error(`Account validation failed: ${error}`)

      result.valid = false

      if (error instanceof DoormanError) {
        result.errors.push({
          field: 'accountId',
          message: error.message,
          suggestion: error.suggestion || 'Check the account ID and API token permissions',
          docsUrl: error.docsUrl || `${this.DOCS_BASE_URL}/setup#account-id`,
        })
      } else {
        result.errors.push({
          field: 'accountId',
          message: `Account validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          suggestion: 'Check your internet connection and account configuration',
          docsUrl: `${this.DOCS_BASE_URL}/troubleshooting`,
        })
      }

      return result
    }
  }

  /**
   * Validate API token format and basic structure
   */
  private validateTokenFormat(token: string): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    }

    if (!token || token.trim().length === 0) {
      result.valid = false
      result.errors.push({
        field: 'apiToken',
        message: 'API token is required',
        suggestion: 'Set CLOUDFLARE_API_TOKEN environment variable or provide it in configuration',
        docsUrl: `${this.DOCS_BASE_URL}/setup#api-token`,
      })
      return result
    }

    // Basic format validation for Cloudflare API tokens
    // Cloudflare API tokens are typically 40 characters long and contain alphanumeric characters and hyphens
    const tokenPattern = /^[A-Za-z0-9_-]{20,}$/
    if (!tokenPattern.test(token)) {
      result.warnings.push({
        field: 'apiToken',
        message: 'API token format appears unusual',
        impact: 'Token may be invalid or corrupted',
      })
      result.suggestions.push('Ensure you copied the complete API token without extra spaces or characters')
    }

    // Check for common mistakes
    if (token.startsWith('Bearer ')) {
      result.errors.push({
        field: 'apiToken',
        message: 'API token should not include "Bearer " prefix',
        suggestion: 'Remove "Bearer " from the beginning of your API token',
        docsUrl: `${this.DOCS_BASE_URL}/setup#api-token`,
      })
      result.valid = false
    }

    if (token.length < 20) {
      result.errors.push({
        field: 'apiToken',
        message: 'API token appears to be too short',
        suggestion: 'Ensure you copied the complete API token from Cloudflare dashboard',
        docsUrl: `${this.DOCS_BASE_URL}/setup#api-token`,
      })
      result.valid = false
    }

    return result
  }

  /**
   * Verify API token with Cloudflare API and get permissions
   */
  private async verifyTokenWithAPI(token: string): Promise<TokenVerificationResult> {
    logger.debug('Verifying API token with Cloudflare API')

    try {
      // Use the token verification endpoint
      const response = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        throw new Error(`Token verification failed: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as CloudflareAPIResponse<{
        id: string
        status: string
        not_before?: string
        expires_on?: string
        policies: Array<{
          id: string
          effect: string
          resources: Record<string, string>
          permission_groups: Array<{
            id: string
            name: string
          }>
        }>
      }>

      if (!data.success) {
        throw new Error(`Token verification failed: ${data.errors.map((e) => e.message).join(', ')}`)
      }

      const tokenInfo = data.result

      // Extract permissions from policies
      const permissions: string[] = []
      const zones: string[] = []
      const accounts: string[] = []

      for (const policy of tokenInfo.policies) {
        // Extract permission names
        for (const permGroup of policy.permission_groups) {
          permissions.push(permGroup.name)
        }

        // Extract accessible resources
        if (policy.resources) {
          Object.entries(policy.resources).forEach(([resourceType, resourceId]) => {
            if (resourceType.includes('zone') && resourceId !== '*') {
              zones.push(resourceId)
            }
            if (resourceType.includes('account') && resourceId !== '*') {
              accounts.push(resourceId)
            }
          })
        }
      }

      logger.debug(`Token verification successful. Permissions: ${permissions.join(', ')}`)

      return {
        valid: true,
        permissions,
        zones,
        accounts,
      }
    } catch (error) {
      logger.error(`Token verification failed: ${error}`)
      throw CloudflareErrorHandler.handleNetworkError(
        error instanceof Error ? error : new Error(String(error)),
        'verifying API token',
      )
    }
  }

  /**
   * Get zone information from Cloudflare API
   */
  private async getZoneInfo(token: string, zoneId: string): Promise<ZoneInfo | null> {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null // Zone not found
        }
        throw new Error(`Failed to get zone info: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as CloudflareAPIResponse<{
        id: string
        name: string
        status: string
        permissions: string[]
      }>

      if (!data.success) {
        throw new Error(`Failed to get zone info: ${data.errors.map((e) => e.message).join(', ')}`)
      }

      return {
        id: data.result.id,
        name: data.result.name,
        status: data.result.status,
        permissions: data.result.permissions || [],
      }
    } catch (error) {
      logger.error(`Failed to get zone info: ${error}`)
      throw error
    }
  }

  /**
   * Get account information from Cloudflare API
   */
  private async getAccountInfo(token: string, accountId: string): Promise<AccountInfo | null> {
    try {
      const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          return null // Account not found
        }
        throw new Error(`Failed to get account info: ${response.status} ${response.statusText}`)
      }

      const data = (await response.json()) as CloudflareAPIResponse<{
        id: string
        name: string
        permissions: string[]
      }>

      if (!data.success) {
        throw new Error(`Failed to get account info: ${data.errors.map((e) => e.message).join(', ')}`)
      }

      return {
        id: data.result.id,
        name: data.result.name,
        permissions: data.result.permissions || [],
      }
    } catch (error) {
      logger.error(`Failed to get account info: ${error}`)
      throw error
    }
  }

  /**
   * Check if the token has required permissions
   */
  private checkRequiredPermissions(tokenPermissions: string[]): ValidationResult {
    const result: ValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      suggestions: [],
    }

    // Check zone permissions
    const hasZoneEdit = tokenPermissions.some((p) => p.includes('Zone') && p.includes('Edit'))
    const hasZoneRead = tokenPermissions.some((p) => p.includes('Zone') && p.includes('Read'))

    if (!hasZoneEdit) {
      result.errors.push({
        field: 'permissions',
        message: 'API token lacks Zone:Edit permission',
        suggestion: 'Add Zone:Edit permission to your API token in the Cloudflare dashboard',
        docsUrl: `${this.DOCS_BASE_URL}/setup#permissions`,
      })
      result.valid = false
    }

    if (!hasZoneRead && !hasZoneEdit) {
      result.errors.push({
        field: 'permissions',
        message: 'API token lacks Zone:Read permission',
        suggestion: 'Add Zone:Read permission to your API token (usually included with Zone:Edit)',
        docsUrl: `${this.DOCS_BASE_URL}/setup#permissions`,
      })
      result.valid = false
    }

    // Check account permissions (optional but recommended)
    const hasAccountRead = tokenPermissions.some((p) => p.includes('Account') && p.includes('Read'))
    if (!hasAccountRead) {
      result.warnings.push({
        field: 'permissions',
        message: 'API token lacks Account:Read permission',
        impact: 'Lists API will not be available for efficient IP blocking',
      })
      result.suggestions.push('Consider adding Account:Read permission to enable Lists API for better performance')
    }

    return result
  }

  /**
   * Validate API token (simplified interface for config validator)
   */
  public async validateApiToken(): Promise<ValidationResult> {
    const credentials: CloudflareCredentials = {
      apiToken: this.apiToken,
      zoneId: this.zoneId,
      accountId: this.accountId,
    }

    try {
      const tokenVerification = await this.verifyTokenWithAPI(credentials.apiToken)

      const result: ValidationResult = {
        valid: tokenVerification.valid,
        errors: [],
        warnings: [],
        suggestions: [],
      }

      if (!tokenVerification.valid) {
        result.errors.push({
          field: 'apiToken',
          message: 'API token is invalid or expired',
          suggestion: 'Create a new API token with the required permissions in the Cloudflare dashboard',
          docsUrl: `${this.DOCS_BASE_URL}/setup#api-token`,
        })
      } else {
        // Check permissions
        const permissionCheck = this.checkRequiredPermissions(tokenVerification.permissions)
        result.errors.push(...permissionCheck.errors)
        result.warnings.push(...permissionCheck.warnings)
        result.suggestions.push(...permissionCheck.suggestions)
        result.valid = result.valid && permissionCheck.valid
      }

      return result
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: 'apiToken',
            message: `Failed to validate API token: ${error instanceof Error ? error.message : 'Unknown error'}`,
            suggestion: 'Check your internet connection and ensure the API token is correct',
            docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#connectivity`,
          },
        ],
        warnings: [],
        suggestions: [],
      }
    }
  }

  /**
   * Test basic connectivity to Cloudflare API
   */
  public async testConnectivity(): Promise<ValidationResult> {
    try {
      const response = await fetch('https://api.cloudflare.com/client/v4/user', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.ok) {
        return {
          valid: true,
          errors: [],
          warnings: [],
          suggestions: ['API connectivity test passed'],
        }
      } else {
        return {
          valid: false,
          errors: [
            {
              field: 'connectivity',
              message: `API connectivity test failed: ${response.status} ${response.statusText}`,
              suggestion: 'Check your internet connection and Cloudflare API status',
              docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#connectivity`,
            },
          ],
          warnings: [],
          suggestions: [],
        }
      }
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: 'connectivity',
            message: `Network connectivity test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            suggestion: 'Check your internet connection and firewall settings',
            docsUrl: `${this.DOCS_BASE_URL}/troubleshooting#connectivity`,
          },
        ],
        warnings: [],
        suggestions: [],
      }
    }
  }

  /**
   * Validate Lists API availability
   */
  public async validateListsApiAvailability(): Promise<ValidationResult> {
    if (!this.accountId) {
      return {
        valid: false,
        errors: [
          {
            field: 'accountId',
            message: 'Account ID is required for Lists API',
            suggestion: 'Set CLOUDFLARE_ACCOUNT_ID environment variable to enable Lists API',
            docsUrl: `${this.DOCS_BASE_URL}/setup#account-id`,
          },
        ],
        warnings: [],
        suggestions: [],
      }
    }

    try {
      const client = new CloudflareClient(this.apiToken, this.zoneId, this.accountId)
      await client.listLists()

      return {
        valid: true,
        errors: [],
        warnings: [],
        suggestions: ['Lists API is available and functional'],
      }
    } catch (error) {
      return {
        valid: false,
        errors: [
          {
            field: 'listsApi',
            message: `Lists API is not available: ${error instanceof Error ? error.message : 'Unknown error'}`,
            suggestion: 'Verify account ID and ensure your API token has Account:Read permissions',
            docsUrl: `${this.DOCS_BASE_URL}/setup#account-id`,
          },
        ],
        warnings: [],
        suggestions: [],
      }
    }
  }

  // Constructor and instance variables for the simplified interface methods
  constructor(
    private apiToken: string,
    private zoneId: string,
    private accountId?: string,
  ) {}
}
