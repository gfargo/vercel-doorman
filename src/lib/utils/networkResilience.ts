import { logger } from '../logger'
import { DoormanError } from '../errors/DoormanError'
import { NetworkErrorCode } from '../errors/ErrorCodes'

/**
 * Network resilience utilities for handling connectivity issues,
 * retries, and graceful degradation
 */

export interface RetryOptions {
  maxRetries: number
  baseDelay: number
  maxDelay: number
  backoffFactor: number
  retryableErrors?: string[]
  onRetry?: (attempt: number, error: Error) => void
}

export interface NetworkFailureContext {
  operation: string
  provider: string
  endpoint?: string
  attempt: number
  totalAttempts: number
}

export interface ProgressState {
  operation: string
  total: number
  completed: number
  failed: number
  startTime: number
  lastUpdate: number
}

/**
 * Default retry configuration for network operations
 */
export const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffFactor: 2,
  retryableErrors: [
    'ENOTFOUND',
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'EPIPE',
    'timeout',
    'network',
    'rate limit',
    '429',
    '502',
    '503',
    '504',
  ],
}

/**
 * Network resilience manager for handling failures and retries
 */
export class NetworkResilienceManager {
  private static instance: NetworkResilienceManager
  private progressStates = new Map<string, ProgressState>()
  private interruptHandlers = new Set<() => Promise<void>>()
  private isShuttingDown = false

  private constructor() {
    this.setupInterruptHandlers()
  }

  public static getInstance(): NetworkResilienceManager {
    if (!NetworkResilienceManager.instance) {
      NetworkResilienceManager.instance = new NetworkResilienceManager()
    }
    return NetworkResilienceManager.instance
  }

  /**
   * Execute an operation with retry logic and network failure handling
   */
  public async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: NetworkFailureContext,
    options: Partial<RetryOptions> = {},
  ): Promise<T> {
    const config = { ...DEFAULT_RETRY_OPTIONS, ...options }
    let lastError: Error | undefined

    for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
      try {
        // Check if we're shutting down
        if (this.isShuttingDown) {
          throw new DoormanError({
            code: NetworkErrorCode.CONNECTION_FAILED,
            message: 'Operation cancelled due to shutdown',
            suggestion: 'Restart the operation when ready',
          })
        }

        const result = await operation()

        // Log successful retry if this wasn't the first attempt
        if (attempt > 1) {
          logger.info(`✅ ${context.operation} succeeded on attempt ${attempt}`)
        }

        return result
      } catch (error) {
        lastError = error as Error

        // Don't retry on the last attempt
        if (attempt > config.maxRetries) {
          break
        }

        // Check if error is retryable
        if (!this.isRetryableError(lastError, config.retryableErrors)) {
          logger.debug(`Non-retryable error for ${context.operation}: ${lastError.message}`)
          break
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(config.baseDelay * Math.pow(config.backoffFactor, attempt - 1), config.maxDelay)

        logger.warn(
          `🔄 ${context.operation} failed (attempt ${attempt}/${config.maxRetries + 1}): ${lastError.message}. ` +
            `Retrying in ${delay / 1000}s...`,
        )

        // Call retry callback if provided
        if (config.onRetry) {
          config.onRetry(attempt, lastError)
        }

        // Wait before retrying
        await this.delay(delay)
      }
    }

    // All retries exhausted, throw enhanced error
    throw this.enhanceNetworkError(lastError!, context, config.maxRetries)
  }

  /**
   * Track progress for long-running operations
   */
  public startProgress(operation: string, total: number): string {
    const progressId = `${operation}_${Date.now()}`
    this.progressStates.set(progressId, {
      operation,
      total,
      completed: 0,
      failed: 0,
      startTime: Date.now(),
      lastUpdate: Date.now(),
    })

    logger.info(`🚀 Starting ${operation} (${total} items)`)
    return progressId
  }

  /**
   * Update progress for an operation
   */
  public updateProgress(progressId: string, completed: number, failed: number = 0): void {
    const state = this.progressStates.get(progressId)
    if (!state) return

    state.completed = completed
    state.failed = failed
    state.lastUpdate = Date.now()

    // Log progress every 10% or every 10 seconds
    const progressPercent = Math.floor((completed / state.total) * 100)
    const timeSinceStart = Date.now() - state.startTime
    const timeSinceLastUpdate = Date.now() - state.lastUpdate

    if (progressPercent % 10 === 0 || timeSinceLastUpdate > 10000) {
      const rate = completed / (timeSinceStart / 1000)
      const eta = state.total > completed ? (state.total - completed) / rate : 0

      logger.info(
        `📊 ${state.operation}: ${completed}/${state.total} (${progressPercent}%) ` +
          `${failed > 0 ? `[${failed} failed] ` : ''}` +
          `[${rate.toFixed(1)}/s] ${eta > 0 ? `ETA: ${Math.ceil(eta)}s` : ''}`,
      )
    }
  }

  /**
   * Complete progress tracking
   */
  public completeProgress(progressId: string): void {
    const state = this.progressStates.get(progressId)
    if (!state) return

    const duration = (Date.now() - state.startTime) / 1000
    const rate = state.completed / duration

    logger.info(
      `✅ ${state.operation} completed: ${state.completed}/${state.total} ` +
        `${state.failed > 0 ? `(${state.failed} failed) ` : ''}` +
        `in ${duration.toFixed(1)}s [${rate.toFixed(1)}/s]`,
    )

    this.progressStates.delete(progressId)
  }

  /**
   * Register cleanup handler for graceful shutdown
   */
  public registerCleanupHandler(handler: () => Promise<void>): void {
    this.interruptHandlers.add(handler)
  }

  /**
   * Unregister cleanup handler
   */
  public unregisterCleanupHandler(handler: () => Promise<void>): void {
    this.interruptHandlers.delete(handler)
  }

  /**
   * Handle graceful shutdown
   */
  private async handleShutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return

    this.isShuttingDown = true
    logger.info(`\n🛑 Received ${signal}, shutting down gracefully...`)

    // Save progress states
    for (const [, state] of this.progressStates.entries()) {
      logger.info(`💾 Saving progress for ${state.operation}: ${state.completed}/${state.total} completed`)
    }

    // Execute cleanup handlers
    const cleanupPromises = Array.from(this.interruptHandlers).map(async (handler) => {
      try {
        await handler()
      } catch (error) {
        logger.error(`Cleanup handler failed: ${error}`)
      }
    })

    await Promise.allSettled(cleanupPromises)
    logger.info('🏁 Graceful shutdown completed')

    // Exit after cleanup
    process.exit(0)
  }

  /**
   * Setup interrupt signal handlers
   */
  private setupInterruptHandlers(): void {
    const signals = ['SIGINT', 'SIGTERM', 'SIGQUIT']

    signals.forEach((signal) => {
      process.on(signal, () => {
        this.handleShutdown(signal).catch((error) => {
          logger.error(`Shutdown handler failed: ${error}`)
          process.exit(1)
        })
      })
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error(`Uncaught exception: ${error.message}`)
      this.handleShutdown('uncaughtException').catch(() => {
        process.exit(1)
      })
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      logger.error(`Unhandled rejection: ${reason}`)
      this.handleShutdown('unhandledRejection').catch(() => {
        process.exit(1)
      })
    })
  }

  /**
   * Check if an error is retryable
   */
  private isRetryableError(error: Error, retryableErrors?: string[]): boolean {
    const patterns = retryableErrors || DEFAULT_RETRY_OPTIONS.retryableErrors!
    const errorMessage = error.message.toLowerCase()

    return patterns.some((pattern) => errorMessage.includes(pattern.toLowerCase()))
  }

  /**
   * Enhance network error with context and suggestions
   */
  private enhanceNetworkError(error: Error, context: NetworkFailureContext, maxRetries: number): DoormanError {
    const errorMessage = error.message.toLowerCase()

    if (errorMessage.includes('timeout')) {
      return new DoormanError({
        code: NetworkErrorCode.TIMEOUT,
        message: `Network timeout during ${context.operation} after ${maxRetries} retries`,
        suggestion: 'Check your internet connection and try again. Consider increasing timeout values.',
        details: {
          operation: context.operation,
          provider: context.provider,
          endpoint: context.endpoint,
          retriesAttempted: maxRetries,
          originalError: error.message,
        },
        cause: error,
      })
    }

    if (errorMessage.includes('enotfound') || errorMessage.includes('dns')) {
      return new DoormanError({
        code: NetworkErrorCode.DNS_ERROR,
        message: `DNS resolution failed for ${context.operation}`,
        suggestion: 'Check your internet connection and DNS settings. Verify the API endpoint is accessible.',
        details: {
          operation: context.operation,
          provider: context.provider,
          endpoint: context.endpoint,
          retriesAttempted: maxRetries,
        },
        cause: error,
      })
    }

    if (errorMessage.includes('econnrefused') || errorMessage.includes('econnreset')) {
      return new DoormanError({
        code: NetworkErrorCode.CONNECTION_FAILED,
        message: `Connection failed during ${context.operation}`,
        suggestion: 'Check your firewall settings and ensure the API endpoint is accessible.',
        details: {
          operation: context.operation,
          provider: context.provider,
          endpoint: context.endpoint,
          retriesAttempted: maxRetries,
        },
        cause: error,
      })
    }

    if (errorMessage.includes('rate limit') || errorMessage.includes('429')) {
      return new DoormanError({
        code: NetworkErrorCode.RATE_LIMITED,
        message: `Rate limit exceeded during ${context.operation}`,
        suggestion: 'Wait before retrying or consider upgrading your API plan for higher rate limits.',
        details: {
          operation: context.operation,
          provider: context.provider,
          endpoint: context.endpoint,
          retriesAttempted: maxRetries,
        },
        cause: error,
      })
    }

    // Generic network error
    return new DoormanError({
      code: NetworkErrorCode.HTTP_ERROR,
      message: `Network error during ${context.operation}: ${error.message}`,
      suggestion: 'Check your internet connection and API credentials. Try again later.',
      details: {
        operation: context.operation,
        provider: context.provider,
        endpoint: context.endpoint,
        retriesAttempted: maxRetries,
      },
      cause: error,
    })
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

/**
 * Convenience function to get the network resilience manager instance
 */
export function getNetworkResilienceManager(): NetworkResilienceManager {
  return NetworkResilienceManager.getInstance()
}

/**
 * Decorator for adding network resilience to async methods
 */
export function withNetworkResilience(
  context: Omit<NetworkFailureContext, 'attempt' | 'totalAttempts'>,
  options?: Partial<RetryOptions>,
) {
  return function (_target: any, _propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const manager = getNetworkResilienceManager()
      const fullContext: NetworkFailureContext = {
        ...context,
        attempt: 1,
        totalAttempts: (options?.maxRetries || DEFAULT_RETRY_OPTIONS.maxRetries) + 1,
      }

      return manager.executeWithRetry(() => originalMethod.apply(this, args), fullContext, options)
    }

    return descriptor
  }
}
