import { BackupGuidance } from '../backupGuidance'
import { existsSync, writeFileSync, readFileSync, mkdirSync } from 'fs'
import type { UnifiedConfig } from '../../types/unified'

// Mock fs functions
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(),
  mkdirSync: jest.fn(),
}))

// Mock path functions
jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/')),
  dirname: jest.fn((path) => path.split('/').slice(0, -1).join('/')),
}))

// Mock the logger
jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

const mockExistsSync = existsSync as jest.MockedFunction<typeof existsSync>
const mockWriteFileSync = writeFileSync as jest.MockedFunction<typeof writeFileSync>
const mockReadFileSync = readFileSync as jest.MockedFunction<typeof readFileSync>
const mockMkdirSync = mkdirSync as jest.MockedFunction<typeof mkdirSync>

describe('BackupGuidance', () => {
  const mockConfig: UnifiedConfig = {
    version: '2.0',
    provider: 'cloudflare',
    rules: [
      {
        id: 'rule_test',
        name: 'Test Rule',
        description: 'Test rule description',
        enabled: true,
        action: {
          type: 'deny',
        },
        conditions: [
          {
            field: 'path',
            operator: 'eq',
            value: '/test',
          },
        ],
      },
    ],
    ips: [
      {
        id: 'ip_test',
        ip: '192.168.1.1',
        action: 'deny',
      },
    ],
  }

  const configPath = '/test/config.json'

  beforeEach(() => {
    jest.clearAllMocks()
    mockExistsSync.mockReturnValue(false)
  })

  describe('createBackup', () => {
    it('should create backup successfully', async () => {
      mockExistsSync.mockReturnValue(false) // backup dir doesn't exist
      mockMkdirSync.mockImplementation(() => undefined)
      mockWriteFileSync.mockImplementation(() => undefined)

      const metadata = await BackupGuidance.createBackup(mockConfig, 'sync rules', configPath)

      expect(metadata.operation).toBe('sync rules')
      expect(metadata.provider).toBe('cloudflare')
      expect(metadata.configPath).toBe(configPath)
      expect(metadata.ruleCount).toBe(1)
      expect(metadata.ipCount).toBe(1)
      expect(mockMkdirSync).toHaveBeenCalled()
      expect(mockWriteFileSync).toHaveBeenCalledTimes(2) // config + metadata
    })

    it('should handle backup creation errors', async () => {
      mockWriteFileSync.mockImplementation(() => {
        throw new Error('Write failed')
      })

      await expect(BackupGuidance.createBackup(mockConfig, 'sync rules', configPath)).rejects.toThrow(
        'Failed to create backup: Write failed',
      )
    })
  })

  describe('listBackups', () => {
    it('should return empty array when backup directory does not exist', () => {
      mockExistsSync.mockReturnValue(false)

      const backups = BackupGuidance.listBackups(configPath)

      expect(backups).toEqual([])
    })

    it('should list available backups', () => {
      // Use the already-mocked fs functions
      mockExistsSync.mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('.doorman-backups')) {
          return true
        }
        if (typeof path === 'string' && path.includes('config-backup-')) {
          return true
        }
        return false
      })

      // Mock readdirSync via require since listBackups uses require('fs').readdirSync
      const fs = require('fs')
      fs.readdirSync = jest.fn().mockReturnValue([
        'config-backup-2023-01-01T00-00-00-000Z.json.meta.json',
        'config-backup-2023-01-02T00-00-00-000Z.json.meta.json',
        'other-file.txt',
      ])

      mockReadFileSync.mockImplementation((path) => {
        if (typeof path === 'string' && path.includes('meta.json')) {
          return JSON.stringify({
            timestamp: '2023-01-01T00:00:00.000Z',
            operation: 'sync rules',
            provider: 'cloudflare',
            configPath: '/test/config.json',
            backupPath: '/test/.doorman-backups/config-backup-2023-01-01T00-00-00-000Z.json',
            ruleCount: 1,
            ipCount: 1,
          })
        }
        return ''
      })

      const backups = BackupGuidance.listBackups(configPath)

      expect(backups).toHaveLength(2)
      expect(backups[0]!.operation).toBe('sync rules')
    })
  })

  describe('showBackupRecommendations', () => {
    it('should not show recommendations for low-risk operations', () => {
      BackupGuidance.showBackupRecommendations('update rules', 'low')

      const { logger } = require('../../logger')
      expect(logger.info).not.toHaveBeenCalled()
    })

    it('should show recommendations for high-risk operations', () => {
      BackupGuidance.showBackupRecommendations('delete ruleset', 'high')

      const { logger } = require('../../logger')
      expect(logger.info).toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    })
  })
})
