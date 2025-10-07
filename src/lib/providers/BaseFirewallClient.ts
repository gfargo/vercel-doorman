import { logger } from '../logger'
import type { ProviderType } from './IFirewallProvider'

/**
 * HTTP request options
 */
export interface RequestOptions extends RequestInit {
  timeout?: number
  retries?: number
  retryDelay?: number
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
  limit?: number
  remaining?: number
  reset?: number
}

/**
 * Abstract base class for firewall API clients
 * Provides common HTTP operations, error handling, retry logic, and rate limiting
 */
export abstract class BaseFirewallClient {
  protected readonly baseUrl: string
  protected readonly providerName: ProviderType
  private rateLimitInfo: RateLimitInfo = {}

  constructor(baseUrl: string, providerName: ProviderType) {
    this.baseUrl = baseUrl
    this.providerName = providerName
  }

  /**
   * Get authentication headers for API requests
   * Must be implemented by provider-specific clients
   */
  protected abstract getAuthHeaders(): Record<string, string>

  /**
   * Make an HTTP request with retry logic and rate limit handling
   * @param path - API endpoint path
   * @param options - Request options
   * @returns Promise resolving to the response data
   */
  protected async makeRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const { timeout = 30000, retries = 3, retryDelay = 1000, ...fetchOptions } = options

    let lastError: Error | null = null

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), timeout)

        const response = await fetch(url, {
          ...fetchOptions,
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeaders(),
            ...fetchOptions.headers,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        // Update rate limit info
        this.updateRateLimitInfo(response)

        // Handle rate limiting
        if (response.status === 429) {
          const waitTime = this.calculateRateLimitWait()
          logger.warn(`Rate limit exceeded for ${this.providerName}. Waiting ${waitTime}ms before retry...`)
          await this.delay(waitTime)
          continue
        }

        // Handle other errors
        if (!response.ok) {
          const error = await this.handleErrorResponse(response)
          throw error
        }

        const data = await response.json()
        return data as T
      } catch (error) {
        lastError = error as Error

        // Don't retry on certain errors
        if (this.isNonRetryableError(error)) {
          throw error
        }

        // Last attempt - throw error
        if (attempt === retries) {
          throw error
        }

        // Calculate exponential backoff delay
        const delay = retryDelay * Math.pow(2, attempt)
        logger.debug(`Request failed (attempt ${attempt + 1}/${retries + 1}). Retrying in ${delay}ms...`)
        await this.delay(delay)
      }
    }

    throw lastError || new Error('Request failed after all retries')
  }

  /**
   * Make a GET request
   */
  protected async get<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>(path, { ...options, method: 'GET' })
  }

  /**
   * Make a POST request
   */
  protected async post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>(path, {
      ...options,
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * Make a PUT request
   */
  protected async put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>(path, {
      ...options,
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * Make a PATCH request
   */
  protected async patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>(path, {
      ...options,
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  /**
   * Make a DELETE request
   */
  protected async delete<T>(path: string, options?: RequestOptions): Promise<T> {
    return this.makeRequest<T>(path, { ...options, method: 'DELETE' })
  }

  /**
   * Update rate limit information from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    const limit = response.headers.get('X-RateLimit-Limit')
    const remaining = response.headers.get('X-RateLimit-Remaining')
    const reset = response.headers.get('X-RateLimit-Reset')

    if (limit) this.rateLimitInfo.limit = parseInt(limit, 10)
    if (remaining) this.rateLimitInfo.remaining = parseInt(remaining, 10)
    if (reset) this.rateLimitInfo.reset = parseInt(reset, 10)

    // Warn if approaching rate limit
    if (this.rateLimitInfo.remaining && this.rateLimitInfo.remaining < 10) {
      logger.warn(`Approaching rate limit for ${this.providerName}: ${this.rateLimitInfo.remaining} requests remaining`)
    }
  }

  /**
   * Calculate wait time for rate limit
   */
  private calculateRateLimitWait(): number {
    if (this.rateLimitInfo.reset) {
      const now = Math.floor(Date.now() / 1000)
      const waitTime = (this.rateLimitInfo.reset - now) * 1000
      return Math.max(waitTime, 1000) // Minimum 1 second
    }
    return 5000 // Default 5 seconds
  }

  /**
   * Handle error response from API
   */
  private async handleErrorResponse(response: Response): Promise<Error> {
    let errorMessage = `${this.providerName} API error: ${response.status} ${response.statusText}`

    try {
      const errorData: unknown = await response.json()
      if (typeof errorData === 'object' && errorData !== null) {
        const data = errorData as Record<string, unknown>
        if (typeof data.error === 'string') {
          errorMessage = `${this.providerName} API error: ${data.error}`
        } else if (typeof data.message === 'string') {
          errorMessage = `${this.providerName} API error: ${data.message}`
        } else if (Array.isArray(data.errors)) {
          const messages = data.errors
            .map((e) => {
              if (typeof e === 'object' && e !== null && 'message' in (e as Record<string, unknown>)) {
                return String((e as Record<string, unknown>).message)
              }
              return JSON.stringify(e)
            })
            .join(', ')
          errorMessage = `${this.providerName} API error: ${messages}`
        }
      }
    } catch {
      // Unable to parse error response
    }

    logger.error(errorMessage)
    return new Error(errorMessage)
  }

  /**
   * Check if error should not be retried
   */
  private isNonRetryableError(error: unknown): boolean {
    // Don't retry on abort errors
    if (typeof error === 'object' && error !== null && (error as { name?: unknown }).name === 'AbortError') {
      return true
    }

    // Don't retry on 4xx errors (except 429)
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.includes('API error: 4')) {
      return !message.includes('429')
    }

    return false
  }

  /**
   * Delay helper
   */
  protected delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Get current rate limit information
   */
  public getRateLimitInfo(): RateLimitInfo {
    return { ...this.rateLimitInfo }
  }
}
