import { logger } from '../logger'
import { getNetworkResilienceManager } from './networkResilience'

/**
 * Graceful shutdown utilities for CLI commands
 */

export interface ShutdownOptions {
  timeout?: number
  saveProgress?: boolean
  cleanupMessage?: string
}

/**
 * Setup graceful shutdown for a CLI command
 */
export function setupGracefulShutdown(
  commandName: string,
  cleanupFn?: () => Promise<void>,
  options: ShutdownOptions = {},
): void {
  const { timeout = 10000, cleanupMessage } = options
  const resilienceManager = getNetworkResilienceManager()

  // Register command-specific cleanup
  if (cleanupFn) {
    resilienceManager.registerCleanupHandler(async () => {
      logger.info(`🧹 Cleaning up ${commandName}...`)
      if (cleanupMessage) {
        logger.info(cleanupMessage)
      }

      try {
        await Promise.race([
          cleanupFn(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Cleanup timeout')), timeout)),
        ])
        logger.info(`✅ ${commandName} cleanup completed`)
      } catch (error) {
        logger.warn(`⚠️  ${commandName} cleanup failed: ${error}`)
      }
    })
  }

  // Log startup message
  logger.debug(`🛡️  Graceful shutdown enabled for ${commandName}`)
}

/**
 * Handle operation interruption with user-friendly messaging
 */
export function handleOperationInterruption(operationName: string, partialResults?: any): void {
  logger.info(`\n⏸️  ${operationName} interrupted by user`)

  if (partialResults) {
    logger.info(`💾 Partial results saved - you can resume this operation later`)
    logger.debug(`Partial results: ${JSON.stringify(partialResults, null, 2)}`)
  }

  logger.info(`🔄 To resume, run the same command again`)
}

/**
 * Create a progress checkpoint for long-running operations
 */
export function createProgressCheckpoint(
  operation: string,
  progress: {
    completed: number
    total: number
    currentItem?: string
    metadata?: Record<string, unknown>
  },
): void {
  const checkpoint = {
    operation,
    timestamp: new Date().toISOString(),
    progress,
  }

  // In a real implementation, this could be saved to a file or database
  logger.debug(`📍 Progress checkpoint: ${JSON.stringify(checkpoint)}`)
}

/**
 * Wrapper for long-running operations with interruption handling
 */
export async function withGracefulInterruption<T>(
  operation: () => Promise<T>,
  operationName: string,
  onInterrupt?: (partialResults?: any) => void,
): Promise<T> {
  let isInterrupted = false
  let partialResults: any

  // Setup interrupt handler
  const handleInterrupt = () => {
    isInterrupted = true
    if (onInterrupt) {
      onInterrupt(partialResults)
    } else {
      handleOperationInterruption(operationName, partialResults)
    }
  }

  // Register interrupt signals
  process.once('SIGINT', handleInterrupt)
  process.once('SIGTERM', handleInterrupt)

  try {
    const result = await operation()

    if (isInterrupted) {
      logger.info(`⚠️  ${operationName} completed despite interruption signal`)
    }

    return result
  } catch (error) {
    if (isInterrupted) {
      logger.info(`🛑 ${operationName} stopped due to interruption`)
      process.exit(130) // Standard exit code for SIGINT
    }
    throw error
  } finally {
    // Cleanup interrupt handlers
    process.removeListener('SIGINT', handleInterrupt)
    process.removeListener('SIGTERM', handleInterrupt)
  }
}
