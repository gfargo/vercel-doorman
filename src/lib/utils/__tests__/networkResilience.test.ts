import { DEFAULT_RETRY_OPTIONS, NetworkResilienceManager, getNetworkResilienceManager } from '../networkResilience'
import { DoormanError } from '../../errors/DoormanError'

// Mock the logger
jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('networkResilience', () => {
  // Mock process.on to prevent real signal handlers from being registered
  let processOnSpy: jest.SpyInstance

  beforeEach(() => {
    jest.clearAllMocks()
    // Mock process.on to prevent real signal handlers
    processOnSpy = jest.spyOn(process, 'on').mockImplementation(() => process)
  })

  afterEach(() => {
    processOnSpy.mockRestore()
  })

  describe('DEFAULT_RETRY_OPTIONS', () => {
    it('should have sensible default maxRetries', () => {
      expect(DEFAULT_RETRY_OPTIONS.maxRetries).toBe(3)
    })

    it('should have sensible default baseDelay', () => {
      expect(DEFAULT_RETRY_OPTIONS.baseDelay).toBe(1000)
    })

    it('should have sensible default maxDelay', () => {
      expect(DEFAULT_RETRY_OPTIONS.maxDelay).toBe(30000)
    })

    it('should have sensible default backoffFactor', () => {
      expect(DEFAULT_RETRY_OPTIONS.backoffFactor).toBe(2)
    })

    it('should have retryable error patterns', () => {
      expect(DEFAULT_RETRY_OPTIONS.retryableErrors).toBeDefined()
      expect(DEFAULT_RETRY_OPTIONS.retryableErrors!.length).toBeGreaterThan(0)
      expect(DEFAULT_RETRY_OPTIONS.retryableErrors).toContain('ENOTFOUND')
      expect(DEFAULT_RETRY_OPTIONS.retryableErrors).toContain('ECONNREFUSED')
      expect(DEFAULT_RETRY_OPTIONS.retryableErrors).toContain('429')
      expect(DEFAULT_RETRY_OPTIONS.retryableErrors).toContain('503')
    })
  })

  describe('getNetworkResilienceManager', () => {
    it('should return a NetworkResilienceManager instance', () => {
      const manager = getNetworkResilienceManager()
      expect(manager).toBeInstanceOf(NetworkResilienceManager)
    })

    it('should return the same singleton instance', () => {
      const manager1 = getNetworkResilienceManager()
      const manager2 = getNetworkResilienceManager()
      expect(manager1).toBe(manager2)
    })
  })

  describe('NetworkResilienceManager.executeWithRetry', () => {
    let manager: NetworkResilienceManager

    beforeEach(() => {
      manager = getNetworkResilienceManager()
      // Mock the delay method to avoid real timeouts
      jest.spyOn(manager as any, 'delay').mockResolvedValue(undefined)
    })

    const defaultContext = {
      operation: 'test-operation',
      provider: 'vercel',
      endpoint: 'https://api.vercel.com',
      attempt: 1,
      totalAttempts: 4,
    }

    it('should return result on success', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await manager.executeWithRetry(operation, defaultContext)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should retry on retryable errors', async () => {
      const operation = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED')).mockResolvedValue('success')

      const result = await manager.executeWithRetry(operation, defaultContext)

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(2)
    })

    it('should throw DoormanError after exhausting retries', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))

      await expect(manager.executeWithRetry(operation, defaultContext, { maxRetries: 2 })).rejects.toThrow(DoormanError)

      // 1 initial + 2 retries = 3 total
      expect(operation).toHaveBeenCalledTimes(3)
    })

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Invalid configuration'))

      await expect(manager.executeWithRetry(operation, defaultContext)).rejects.toThrow('Invalid configuration')

      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should call onRetry callback on each retry', async () => {
      const onRetry = jest.fn()
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue('success')

      await manager.executeWithRetry(operation, defaultContext, { onRetry })

      expect(onRetry).toHaveBeenCalledTimes(2)
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error))
      expect(onRetry).toHaveBeenCalledWith(2, expect.any(Error))
    })

    it('should enhance timeout errors with proper DoormanError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Request timeout'))

      try {
        await manager.executeWithRetry(operation, defaultContext, { maxRetries: 0 })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DoormanError)
        expect((error as DoormanError).message).toContain('timeout')
      }
    })

    it('should enhance DNS errors with proper DoormanError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('ENOTFOUND api.vercel.com'))

      try {
        await manager.executeWithRetry(operation, defaultContext, { maxRetries: 0 })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DoormanError)
        expect((error as DoormanError).message).toContain('DNS')
      }
    })

    it('should enhance rate limit errors with proper DoormanError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('429 rate limit exceeded'))

      try {
        await manager.executeWithRetry(operation, defaultContext, { maxRetries: 0 })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DoormanError)
        expect((error as DoormanError).message).toContain('Rate limit')
      }
    })

    it('should enhance connection errors with proper DoormanError', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'))

      try {
        await manager.executeWithRetry(operation, defaultContext, { maxRetries: 0 })
        fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(DoormanError)
        expect((error as DoormanError).message).toContain('Connection failed')
      }
    })
  })

  describe('progress tracking', () => {
    let manager: NetworkResilienceManager

    beforeEach(() => {
      manager = getNetworkResilienceManager()
    })

    it('startProgress should return a progress ID', () => {
      const progressId = manager.startProgress('sync', 10)
      expect(progressId).toBeDefined()
      expect(typeof progressId).toBe('string')
      expect(progressId).toContain('sync')
    })

    it('updateProgress should not throw for valid progress ID', () => {
      const progressId = manager.startProgress('sync', 10)
      expect(() => manager.updateProgress(progressId, 5)).not.toThrow()
    })

    it('updateProgress should not throw for invalid progress ID', () => {
      expect(() => manager.updateProgress('nonexistent', 5)).not.toThrow()
    })

    it('completeProgress should not throw for valid progress ID', () => {
      const progressId = manager.startProgress('sync', 10)
      manager.updateProgress(progressId, 10)
      expect(() => manager.completeProgress(progressId)).not.toThrow()
    })

    it('completeProgress should not throw for invalid progress ID', () => {
      expect(() => manager.completeProgress('nonexistent')).not.toThrow()
    })
  })

  describe('cleanup handler management', () => {
    let manager: NetworkResilienceManager

    beforeEach(() => {
      manager = getNetworkResilienceManager()
    })

    it('registerCleanupHandler should accept a handler function', () => {
      const handler = jest.fn().mockResolvedValue(undefined)
      expect(() => manager.registerCleanupHandler(handler)).not.toThrow()
    })

    it('unregisterCleanupHandler should remove a handler', () => {
      const handler = jest.fn().mockResolvedValue(undefined)
      manager.registerCleanupHandler(handler)
      expect(() => manager.unregisterCleanupHandler(handler)).not.toThrow()
    })

    it('unregisterCleanupHandler should not throw for unregistered handler', () => {
      const handler = jest.fn().mockResolvedValue(undefined)
      expect(() => manager.unregisterCleanupHandler(handler)).not.toThrow()
    })
  })
})
