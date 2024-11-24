import { logger } from '../logger'

export interface RetryOptions {
  maxAttempts?: number
  delayMs?: number
  backoff?: boolean
}

export async function retry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maxAttempts = 3, delayMs = 1000, backoff = true } = options

  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === maxAttempts) {
        break
      }

      const delay = backoff ? delayMs * attempt : delayMs
      logger.debug(`Retry attempt ${attempt}/${maxAttempts} failed. Retrying in ${delay}ms...`)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError?.message}`)
}
