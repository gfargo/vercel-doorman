import {
    detectSchemaVersion,
    needsMigration,
    migrateV1ToV2,
    autoMigrate,
    isCompatibleVersion,
    CURRENT_SCHEMA_VERSION,
    LEGACY_SCHEMA_VERSION,
} from '../schemaVersion'
import type { FirewallConfig } from '../../types/vercel'
import type { UnifiedConfig } from '../../types/unified'

// Mock the logger
jest.mock('../../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}))

describe('schemaVersion', () => {
  describe('constants', () => {
    it('CURRENT_SCHEMA_VERSION should be 2.0', () => {
      expect(CURRENT_SCHEMA_VERSION).toBe('2.0')
    })

    it('LEGACY_SCHEMA_VERSION should be 1.0', () => {
      expect(LEGACY_SCHEMA_VERSION).toBe('1.0')
    })
  })

  describe('detectSchemaVersion', () => {
    it('should detect v1 config with projectId', () => {
      const config = { projectId: 'proj_123', teamId: 'team_456', rules: [] }
      expect(detectSchemaVersion(config)).toBe('1.0')
    })

    it('should detect v1 config with teamId only', () => {
      const config = { teamId: 'team_456', rules: [] }
      expect(detectSchemaVersion(config)).toBe('1.0')
    })

    it('should detect v2 config with provider field', () => {
      const config = { provider: 'vercel', rules: [] }
      expect(detectSchemaVersion(config)).toBe('2.0')
    })

    it('should detect v2 config with providers field', () => {
      const config = { providers: { vercel: {} }, rules: [] }
      expect(detectSchemaVersion(config)).toBe('2.0')
    })

    it('should use explicit version string when present', () => {
      const config = { version: '1.0', rules: [] }
      expect(detectSchemaVersion(config)).toBe('1.0')
    })

    it('should use explicit version string even with v2 fields', () => {
      const config = { version: '1.0', provider: 'vercel', rules: [] }
      expect(detectSchemaVersion(config)).toBe('1.0')
    })

    it('should default to CURRENT_SCHEMA_VERSION for empty object', () => {
      expect(detectSchemaVersion({})).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('should default to CURRENT_SCHEMA_VERSION for null', () => {
      expect(detectSchemaVersion(null)).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('should default to CURRENT_SCHEMA_VERSION for undefined', () => {
      expect(detectSchemaVersion(undefined)).toBe(CURRENT_SCHEMA_VERSION)
    })

    it('should default to CURRENT_SCHEMA_VERSION for non-object types', () => {
      expect(detectSchemaVersion('string')).toBe(CURRENT_SCHEMA_VERSION)
      expect(detectSchemaVersion(42)).toBe(CURRENT_SCHEMA_VERSION)
      expect(detectSchemaVersion(true)).toBe(CURRENT_SCHEMA_VERSION)
    })
  })

  describe('needsMigration', () => {
    it('should return true for v1 config', () => {
      const config = { projectId: 'proj_123', teamId: 'team_456', rules: [] }
      expect(needsMigration(config)).toBe(true)
    })

    it('should return false for v2 config', () => {
      const config = { provider: 'vercel', rules: [] }
      expect(needsMigration(config)).toBe(false)
    })

    it('should return false for config with explicit version 2.0', () => {
      const config = { version: '2.0', rules: [] }
      expect(needsMigration(config)).toBe(false)
    })

    it('should return true for config with explicit version 1.0', () => {
      const config = { version: '1.0', rules: [] }
      expect(needsMigration(config)).toBe(true)
    })
  })

  describe('migrateV1ToV2', () => {
    const createV1Config = (): FirewallConfig => ({
      projectId: 'proj_123',
      teamId: 'team_456',
      rules: [
        {
          id: 'rule_1',
          name: 'Block bad bots',
          description: 'Blocks known bad bots',
          active: true,
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'user_agent',
                  op: 'sub',
                  value: 'BadBot',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'deny',
              rateLimit: null,
              redirect: null,
              actionDuration: null,
            },
          },
        },
      ],
      ips: [
        {
          id: 'ip_1',
          ip: '1.2.3.4',
          hostname: 'example.com',
          notes: 'Blocked IP',
          action: 'deny',
        },
      ],
      version: 1,
      updatedAt: '2024-01-01T00:00:00Z',
    })

    it('should migrate v1 config to v2 format', () => {
      const v1Config = createV1Config()
      const result = migrateV1ToV2(v1Config)

      expect(result.version).toBe('2.0')
      expect(result.provider).toBe('vercel')
      expect(result.$schema).toBe('https://doorman.griffen.codes/schema.json')
    })

    it('should preserve provider settings in providers field', () => {
      const v1Config = createV1Config()
      const result = migrateV1ToV2(v1Config)

      expect(result.providers).toEqual({
        vercel: {
          projectId: 'proj_123',
          teamId: 'team_456',
        },
      })
    })

    it('should migrate rules correctly', () => {
      const v1Config = createV1Config()
      const result = migrateV1ToV2(v1Config)
      const rule = result.rules[0]!

      expect(result.rules).toHaveLength(1)
      expect(rule.id).toBe('rule_1')
      expect(rule.name).toBe('Block bad bots')
      expect(rule.description).toBe('Blocks known bad bots')
      expect(rule.enabled).toBe(true)
      expect(rule.action.type).toBe('deny')
    })

    it('should migrate conditions from condition groups', () => {
      const v1Config = createV1Config()
      const result = migrateV1ToV2(v1Config)
      const rule = result.rules[0]!
      const condition = rule.conditions[0]!

      expect(rule.conditions).toHaveLength(1)
      expect(condition.field).toBe('user_agent')
      expect(condition.operator).toBe('contains')
      expect(condition.value).toBe('BadBot')
    })

    it('should set conditionLogic to OR', () => {
      const v1Config = createV1Config()
      const result = migrateV1ToV2(v1Config)

      expect(result.rules[0]!.conditionLogic).toBe('OR')
    })

    it('should migrate IP rules', () => {
      const v1Config = createV1Config()
      const result = migrateV1ToV2(v1Config)
      const ip = result.ips![0]!

      expect(result.ips).toHaveLength(1)
      expect(ip.ip).toBe('1.2.3.4')
      expect(ip.hostname).toBe('example.com')
      expect(ip.notes).toBe('Blocked IP')
      expect(ip.action).toBe('deny')
    })

    it('should include migration metadata', () => {
      const v1Config = createV1Config()
      const result = migrateV1ToV2(v1Config)

      expect(result.metadata).toBeDefined()
      expect(result.metadata!.version).toBe(1)
      expect(result.metadata!.updatedAt).toBe('2024-01-01T00:00:00Z')
      expect(result.metadata!.migratedFrom).toBe('1.0')
      expect(result.metadata!.migratedAt).toBeDefined()
    })

    it('should migrate rate limit rules', () => {
      const v1Config = createV1Config()
      const rule = v1Config.rules[0]!
      rule.action.mitigate.action = 'rate_limit'
      rule.action.mitigate.rateLimit = {
        requests: 100,
        window: '60s',
      }

      const result = migrateV1ToV2(v1Config)
      const migratedRule = result.rules[0]!

      expect(migratedRule.action.type).toBe('rate_limit')
      expect(migratedRule.action.rateLimit).toEqual({
        requests: 100,
        window: '60s',
      })
    })

    it('should migrate redirect rules', () => {
      const v1Config = createV1Config()
      const rule = v1Config.rules[0]!
      rule.action.mitigate.action = 'redirect'
      rule.action.mitigate.redirect = {
        location: 'https://example.com',
        permanent: true,
      }

      const result = migrateV1ToV2(v1Config)
      const migratedRule = result.rules[0]!

      expect(migratedRule.action.type).toBe('redirect')
      expect(migratedRule.action.redirect).toEqual({
        location: 'https://example.com',
        permanent: true,
      })
    })

    it('should handle actionDuration', () => {
      const v1Config = createV1Config()
      const rule = v1Config.rules[0]!
      rule.action.mitigate.actionDuration = '1h'

      const result = migrateV1ToV2(v1Config)

      expect(result.rules[0]!.action.duration).toBe('1h')
    })
  })

  describe('autoMigrate', () => {
    it('should migrate v1 config to v2', () => {
      const v1Config = {
        projectId: 'proj_123',
        teamId: 'team_456',
        rules: [],
        ips: [],
        version: 1,
        updatedAt: '2024-01-01T00:00:00Z',
      }

      const result = autoMigrate(v1Config)
      expect(result.version).toBe('2.0')
      expect(result.provider).toBe('vercel')
    })

    it('should pass through v2 config unchanged', () => {
      const v2Config: UnifiedConfig = {
        version: '2.0',
        provider: 'vercel',
        rules: [],
      }

      const result = autoMigrate(v2Config)
      expect(result).toBe(v2Config)
    })

    it('should throw for unsupported version', () => {
      const config = { version: '3.0', rules: [] }
      expect(() => autoMigrate(config)).toThrow('Unsupported schema version: 3.0')
    })
  })

  describe('isCompatibleVersion', () => {
    it('should return true for version 1.0', () => {
      expect(isCompatibleVersion('1.0')).toBe(true)
    })

    it('should return true for version 2.0', () => {
      expect(isCompatibleVersion('2.0')).toBe(true)
    })

    it('should return false for version 3.0', () => {
      expect(isCompatibleVersion('3.0')).toBe(false)
    })

    it('should return false for empty string', () => {
      expect(isCompatibleVersion('')).toBe(false)
    })

    it('should return false for arbitrary string', () => {
      expect(isCompatibleVersion('foo')).toBe(false)
    })
  })
})
