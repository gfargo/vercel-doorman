import { logger } from '../logger'

/**
 * Options for batch processing
 */
export interface BatchOptions {
  /** Maximum number of concurrent operations (default: 5) */
  concurrency: number
  /** Timeout per individual operation in ms (default: 30000) */
  operationTimeout: number
  /** Whether to continue processing on individual failures (default: true) */
  continueOnError: boolean
  /** Delay between batches in ms to avoid rate limiting (default: 0) */
  batchDelay: number
}

const DEFAULT_BATCH_OPTIONS: BatchOptions = {
  concurrency: 5,
  operationTimeout: 30000,
  continueOnError: true,
  batchDelay: 0,
}

/**
 * Result of a single operation within a batch
 */
export interface BatchOperationResult<T> {
  index: number
  success: boolean
  result?: T
  error?: Error
  duration: number
}

/**
 * Aggregate result of a batch execution
 */
export interface BatchResult<T> {
  results: BatchOperationResult<T>[]
  succeeded: number
  failed: number
  totalDuration: number
}

/**
 * Execute an array of async operations with controlled concurrency.
 *
 * Operations are dispatched in groups of `concurrency` size. Within each
 * group, operations run in parallel. An optional `batchDelay` is inserted
 * between groups to stay within rate limits.
 */
export async function executeBatch<T>(
  operations: (() => Promise<T>)[],
  options: Partial<BatchOptions> = {},
): Promise<BatchResult<T>> {
  const config = { ...DEFAULT_BATCH_OPTIONS, ...options }
  const results: BatchOperationResult<T>[] = []
  const startTime = Date.now()

  if (operations.length === 0) {
    return { results: [], succeeded: 0, failed: 0, totalDuration: 0 }
  }

  logger.debug(`Starting batch execution: ${operations.length} operations, concurrency=${config.concurrency}`)

  // Split into chunks of `concurrency` size
  for (let i = 0; i < operations.length; i += config.concurrency) {
    const chunk = operations.slice(i, i + config.concurrency)
    const chunkIndex = Math.floor(i / config.concurrency) + 1
    const totalChunks = Math.ceil(operations.length / config.concurrency)

    logger.debug(`Processing batch ${chunkIndex}/${totalChunks} (${chunk.length} operations)`)

    const chunkResults = await Promise.allSettled(
      chunk.map((op, localIdx) => executeWithTimeout(op, config.operationTimeout, i + localIdx)),
    )

    for (let j = 0; j < chunkResults.length; j++) {
      const settled = chunkResults[j]!
      const globalIndex = i + j

      if (settled.status === 'fulfilled') {
        results.push(settled.value)
      } else {
        const reason = settled.reason
        results.push({
          index: globalIndex,
          success: false,
          error: reason instanceof Error ? reason : new Error(String(reason)),
          duration: 0,
        })
      }
    }

    // Check for failures if we should stop on error
    if (!config.continueOnError) {
      const hasFailure = results.some((r) => !r.success)
      if (hasFailure) {
        logger.warn(`Batch execution stopped early due to failure at batch ${chunkIndex}`)
        break
      }
    }

    // Delay between batches (skip after the last batch)
    if (config.batchDelay > 0 && i + config.concurrency < operations.length) {
      logger.debug(`Batch delay: ${config.batchDelay}ms`)
      await delay(config.batchDelay)
    }
  }

  const totalDuration = Date.now() - startTime
  const succeeded = results.filter((r) => r.success).length
  const failed = results.filter((r) => !r.success).length

  logger.debug(`Batch execution complete: ${succeeded} succeeded, ${failed} failed in ${totalDuration}ms`)

  return { results, succeeded, failed, totalDuration }
}

/**
 * Execute independent async operations in parallel with a concurrency limit.
 * Unlike `executeBatch`, this accepts heterogeneous operations via a record
 * and returns results keyed the same way.
 */
export async function executeParallel<K extends string>(
  operations: Record<K, () => Promise<unknown>>,
  concurrency: number = 5,
): Promise<Record<K, unknown>> {
  const keys = Object.keys(operations) as K[]
  const entries = keys.map((key) => ({ key, op: operations[key]! }))

  const resultMap = {} as Record<K, unknown>

  // Process in chunks
  for (let i = 0; i < entries.length; i += concurrency) {
    const chunk = entries.slice(i, i + concurrency)
    const settled = await Promise.allSettled(chunk.map((e) => e.op()))

    for (let j = 0; j < chunk.length; j++) {
      const entry = chunk[j]!
      const result = settled[j]!
      if (result.status === 'fulfilled') {
        resultMap[entry.key] = result.value
      } else {
        const reason = result.reason
        resultMap[entry.key] = reason instanceof Error ? reason : new Error(String(reason))
      }
    }
  }

  return resultMap
}

/**
 * Optimized diff for large rule sets.
 *
 * Builds lookup maps for O(1) access instead of O(n) linear scans,
 * reducing diff time from O(n²) to O(n) for large rule sets.
 */
export function optimizedDiff<T extends object>(
  local: T[],
  remote: T[],
  idKey: keyof T & string,
  equalFn: (a: T, b: T) => boolean,
): { toAdd: T[]; toUpdate: T[]; toDelete: T[] } {
  const remoteMap = new Map<unknown, T>()
  for (const item of remote) {
    remoteMap.set(item[idKey], item)
  }

  const localMap = new Map<unknown, T>()
  for (const item of local) {
    localMap.set(item[idKey], item)
  }

  const toAdd: T[] = []
  const toUpdate: T[] = []

  for (const localItem of local) {
    const id = localItem[idKey]
    const remoteItem = remoteMap.get(id)
    if (!remoteItem) {
      toAdd.push(localItem)
    } else if (!equalFn(localItem, remoteItem)) {
      toUpdate.push(localItem)
    }
  }

  const toDelete: T[] = []
  for (const remoteItem of remote) {
    const id = remoteItem[idKey]
    if (!localMap.has(id)) {
      toDelete.push(remoteItem)
    }
  }

  return { toAdd, toUpdate, toDelete }
}

// ── helpers ──────────────────────────────────────────────────────────────

async function executeWithTimeout<T>(
  operation: () => Promise<T>,
  timeout: number,
  index: number,
): Promise<BatchOperationResult<T>> {
  const start = Date.now()

  return new Promise<BatchOperationResult<T>>((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve({
          index,
          success: false,
          error: new Error(`Operation ${index} timed out after ${timeout}ms`),
          duration: Date.now() - start,
        })
      }
    }, timeout)

    operation()
      .then((result) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({ index, success: true, result, duration: Date.now() - start })
        }
      })
      .catch((error) => {
        if (!settled) {
          settled = true
          clearTimeout(timer)
          resolve({
            index,
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            duration: Date.now() - start,
          })
        }
      })
  })
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
