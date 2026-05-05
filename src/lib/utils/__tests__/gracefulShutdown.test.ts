import {
    setupGracefulShutdown,
    handleOperationInterruption,
    createProgressCheckpoint,
    withGracefulInterruption,
} from '../gracefulShutdown'
import { logger } from '../../logger'

// Mock the logger
jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

// Mock networkResilience
const mockRegisterCleanupHandler = jest.fn()
jest.mock('../networkResilience', () => ({
  getNetworkResilienceManager: () => ({
    registerCleanupHandler: mockRegisterCleanupHandler,
  }),
}))

describe('gracefulShutdown', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('setupGracefulShutdown', () => {
    it('should log debug message when called', () => {
      setupGracefulShutdown('test-command')

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Graceful shutdown enabled for test-command'),
      )
    })

    it('should register cleanup handler when cleanupFn is provided', () => {
      const cleanupFn = jest.fn().mockResolvedValue(undefined)
      setupGracefulShutdown('test-command', cleanupFn)

      expect(mockRegisterCleanupHandler).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should not register cleanup handler when cleanupFn is not provided', () => {
      setupGracefulShutdown('test-command')

      expect(mockRegisterCleanupHandler).not.toHaveBeenCalled()
    })

    it('should accept options with timeout and cleanupMessage', () => {
      const cleanupFn = jest.fn().mockResolvedValue(undefined)
      setupGracefulShutdown('test-command', cleanupFn, {
        timeout: 5000,
        cleanupMessage: 'Custom cleanup message',
      })

      expect(mockRegisterCleanupHandler).toHaveBeenCalled()
      expect(logger.debug).toHaveBeenCalled()
    })
  })

  describe('handleOperationInterruption', () => {
    it('should log interruption message', () => {
      handleOperationInterruption('sync')

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('sync'))
      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('interrupted'))
    })

    it('should log partial results when provided', () => {
      const partialResults = { completed: 5, total: 10 }
      handleOperationInterruption('sync', partialResults)

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Partial results saved'))
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining(JSON.stringify(partialResults, null, 2)),
      )
    })

    it('should not log partial results when not provided', () => {
      handleOperationInterruption('sync')

      expect(logger.info).not.toHaveBeenCalledWith(
        expect.stringContaining('Partial results saved'),
      )
    })

    it('should log resume message', () => {
      handleOperationInterruption('sync')

      expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('resume'))
    })
  })

  describe('createProgressCheckpoint', () => {
    it('should log checkpoint data', () => {
      const progress = {
        completed: 5,
        total: 10,
        currentItem: 'rule_5',
      }

      createProgressCheckpoint('sync', progress)

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Progress checkpoint'),
      )
    })

    it('should include operation name in checkpoint', () => {
      createProgressCheckpoint('download', { completed: 3, total: 8 })

      const debugCall = (logger.debug as unknown as jest.Mock).mock.calls[0]![0] as string
      expect(debugCall).toContain('download')
    })

    it('should include progress data in checkpoint', () => {
      const progress = {
        completed: 5,
        total: 10,
        metadata: { provider: 'vercel' },
      }

      createProgressCheckpoint('sync', progress)

      const debugCall = (logger.debug as unknown as jest.Mock).mock.calls[0]![0] as string
      expect(debugCall).toContain('5')
      expect(debugCall).toContain('10')
    })
  })

  describe('withGracefulInterruption', () => {
    let processOnceSpy: jest.SpyInstance
    let processRemoveListenerSpy: jest.SpyInstance

    beforeEach(() => {
      processOnceSpy = jest.spyOn(process, 'once').mockImplementation(() => process)
      processRemoveListenerSpy = jest.spyOn(process, 'removeListener').mockImplementation(() => process)
    })

    afterEach(() => {
      processOnceSpy.mockRestore()
      processRemoveListenerSpy.mockRestore()
    })

    it('should execute the operation and return its result', async () => {
      const operation = jest.fn().mockResolvedValue('success')

      const result = await withGracefulInterruption(operation, 'test-op')

      expect(result).toBe('success')
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('should register SIGINT and SIGTERM handlers', async () => {
      const operation = jest.fn().mockResolvedValue('done')

      await withGracefulInterruption(operation, 'test-op')

      expect(processOnceSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(processOnceSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    })

    it('should remove signal handlers after operation completes', async () => {
      const operation = jest.fn().mockResolvedValue('done')

      await withGracefulInterruption(operation, 'test-op')

      expect(processRemoveListenerSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(processRemoveListenerSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    })

    it('should remove signal handlers even when operation throws', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('fail'))

      await expect(withGracefulInterruption(operation, 'test-op')).rejects.toThrow('fail')

      expect(processRemoveListenerSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
      expect(processRemoveListenerSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
    })

    it('should call custom onInterrupt handler when interrupted', async () => {
      const onInterrupt = jest.fn()
      // Create a long-running operation that we can interrupt
      let resolveOp: (value: string) => void
      const operation = jest.fn().mockImplementation(
        () => new Promise<string>((resolve) => { resolveOp = resolve }),
      )

      // Start the operation but don't await yet
      const promise = withGracefulInterruption(operation, 'test-op', onInterrupt)

      // Get the SIGINT handler and call it
      const sigintCall = processOnceSpy.mock.calls.find(
        (call: unknown[]) => call[0] === 'SIGINT',
      )
      expect(sigintCall).toBeDefined()
      const sigintHandler = sigintCall![1] as () => void
      sigintHandler()

      // Resolve the operation
      resolveOp!('done')
      const result = await promise

      expect(result).toBe('done')
      expect(onInterrupt).toHaveBeenCalled()
    })
  })
})
