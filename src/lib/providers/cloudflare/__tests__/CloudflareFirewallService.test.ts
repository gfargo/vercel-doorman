import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals'
import { CloudflareFirewallService } from '../CloudflareFirewallService'
import { CloudflareClient } from '../CloudflareClient'
import type { UnifiedConfig, UnifiedRule, UnifiedIPRule } from '../../../types/unified'
import type { CloudflareRuleset } from '../../../types/cloudflare'

describe('CloudflareFirewallService', () => {
  const API_TOKEN = 'test-token'
  const ZONE_ID = 'test-zone-id'
  const ACCOUNT_ID = 'test-account-id'

  let service: CloudflareFirewallService
  let mockClient: CloudflareClient

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks()

    // Create service with account ID (enables Lists)
    service = new CloudflareFirewallService(API_TOKEN, ZONE_ID, ACCOUNT_ID)

    // Get the client instance to mock its methods
    mockClient = service['client']
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('fetchConfig', () => {
    it('should fetch configuration from Cloudflare', async () => {
      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test Description',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '5',
        last_updated: '2024-01-01T00:00:00Z',
        rules: [
          {
            id: 'rule-1',
            action: 'block',
            expression: 'http.request.uri.path eq "/blocked"',
            description: 'Block specific path',
            enabled: true,
          },
        ],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([])

      const config = await service.fetchConfig()

      expect(config.version).toBe('2.0')
      expect(config.provider).toBe('cloudflare')
      expect(config.rules).toHaveLength(1)
      expect(config.metadata?.version).toBe(5)
      expect(mockClient.getOrCreateFirewallRuleset).toHaveBeenCalledTimes(1)
    })

    it('should fetch IPs from Lists when account ID is provided', async () => {
      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 2,
        num_referencing_filters: 1,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([
        {
          id: 'item-1',
          ip: '192.168.1.1',
          comment: 'Test IP 1',
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
        {
          id: 'item-2',
          ip: '192.168.1.2',
          comment: 'Test IP 2',
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
      ])

      const config = await service.fetchConfig()

      expect(config.ips).toHaveLength(2)
      expect(config.ips?.[0]?.ip).toBe('192.168.1.1')
      expect(config.ips?.[1]?.ip).toBe('192.168.1.2')
      expect(mockClient.getOrCreateIPBlocklist).toHaveBeenCalledTimes(1)
      expect(mockClient.getListItems).toHaveBeenCalledWith('list-1')
    })

    it('should handle List-based IP rules in ruleset', async () => {
      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [
          {
            id: 'rule-1',
            action: 'block',
            expression: 'ip.src in $doorman_ip_blocklist',
            description: 'Block IPs in Doorman IP Blocklist',
            enabled: true,
          },
        ],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 1,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([])

      const config = await service.fetchConfig()

      // List-based rules should be skipped in rules array (IPs fetched separately)
      expect(config.rules).toHaveLength(0)
    })

    it('should handle individual IP blocking rules', async () => {
      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [
          {
            id: 'rule-1',
            action: 'block',
            expression: 'ip.src eq 192.168.1.100',
            description: 'Block specific IP (example.com)',
            enabled: true,
          },
        ],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([])

      const config = await service.fetchConfig()

      expect(config.ips).toHaveLength(1)
      expect(config.ips?.[0]?.ip).toBe('192.168.1.100')
      expect(config.ips?.[0]?.hostname).toBe('example.com')
    })

    it('should continue if Lists API fails', async () => {
      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockRejectedValue(new Error('Lists API error'))

      const config = await service.fetchConfig()

      expect(config.rules).toHaveLength(0)
      expect(config.ips).toHaveLength(0)
      // Should not throw, just log warning
    })
  })

  describe('syncRules', () => {
    it('should sync rules in dry run mode', async () => {
      const mockConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Test Rule',
            description: 'Test Description',
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
        ips: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue({
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      })
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([])
      const updateRulesetSpy = jest.spyOn(mockClient, 'updateRuleset')

      const result = await service.syncRules(mockConfig, { dryRun: true })

      expect(result.success).toBe(true)
      expect(result.rulesAdded).toBe(1)
      expect(updateRulesetSpy).not.toHaveBeenCalled()
    })

    it('should sync rules to Cloudflare', async () => {
      const mockConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Test Rule',
            description: 'Test Description',
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
        ips: [],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '2',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'updateRuleset').mockResolvedValue({
        ...mockRuleset,
        version: '3',
      })

      const result = await service.syncRules(mockConfig)

      expect(result.success).toBe(true)
      expect(result.rulesAdded).toBe(1)
      expect(result.version).toBe(3)
      expect(mockClient.updateRuleset).toHaveBeenCalledTimes(1)
    })

    it('should sync IPs using Lists when account ID is provided', async () => {
      const mockConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [
          {
            id: 'ip-1',
            ip: '192.168.1.1',
            notes: 'Test IP',
            action: 'deny',
          },
          {
            id: 'ip-2',
            ip: '192.168.1.2',
            hostname: 'example.com',
            action: 'deny',
          },
        ],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([])
      jest.spyOn(mockClient, 'addListItems').mockResolvedValue([])
      jest.spyOn(mockClient, 'updateRuleset').mockResolvedValue({
        ...mockRuleset,
        version: '2',
      })

      const result = await service.syncRules(mockConfig)

      expect(result.success).toBe(true)
      expect(result.ipsAdded).toBe(2)
      expect(mockClient.addListItems).toHaveBeenCalledWith('list-1', {
        items: [
          { ip: '192.168.1.1', comment: 'Test IP' },
          { ip: '192.168.1.2', comment: 'example.com' },
        ],
      })
    })

    it('should remove IPs no longer in config', async () => {
      const mockConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [
          {
            id: 'ip-1',
            ip: '192.168.1.1',
            action: 'deny',
          },
        ],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 2,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([
        {
          id: 'item-1',
          ip: '192.168.1.1',
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
        {
          id: 'item-2',
          ip: '192.168.1.2', // This one should be removed
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
      ])
      jest.spyOn(mockClient, 'removeListItems').mockResolvedValue(undefined)
      jest.spyOn(mockClient, 'updateRuleset').mockResolvedValue({
        ...mockRuleset,
        version: '2',
      })

      const result = await service.syncRules(mockConfig)

      expect(result.success).toBe(true)
      expect(result.ipsDeleted).toBe(1)
      expect(mockClient.removeListItems).toHaveBeenCalledWith('list-1', {
        items: [{ id: 'item-2' }],
      })
    })

    it('should fall back to individual IP rules if Lists API fails', async () => {
      const mockConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [
          {
            id: 'ip-1',
            ip: '192.168.1.1',
            action: 'deny',
          },
        ],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockRejectedValue(new Error('Lists API error'))
      jest.spyOn(mockClient, 'updateRuleset').mockResolvedValue({
        ...mockRuleset,
        version: '2',
      })

      const result = await service.syncRules(mockConfig)

      expect(result.success).toBe(true)
      expect(result.ipsAdded).toBe(1)
      // Should have used individual IP rules as fallback
    })

    it('should use individual IP rules when no account ID provided', async () => {
      const serviceWithoutAccount = new CloudflareFirewallService(API_TOKEN, ZONE_ID)
      const mockClientNoAccount = serviceWithoutAccount['client'] as jest.Mocked<CloudflareClient>

      const mockConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [
          {
            id: 'ip-1',
            ip: '192.168.1.1',
            action: 'deny',
          },
        ],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClientNoAccount, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClientNoAccount, 'updateRuleset').mockResolvedValue({
        ...mockRuleset,
        version: '2',
      })
      const getOrCreateIPBlocklistSpy = jest.spyOn(mockClientNoAccount, 'getOrCreateIPBlocklist')

      const result = await serviceWithoutAccount.syncRules(mockConfig)

      expect(result.success).toBe(true)
      expect(result.ipsAdded).toBe(1)
      expect(getOrCreateIPBlocklistSpy).not.toHaveBeenCalled()
    })
  })

  describe('getChanges', () => {
    it('should detect rules to add', async () => {
      const localConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'New Rule',
            description: 'New rule to add',
            enabled: true,
            action: { type: 'deny' },
            conditions: [
              {
                field: 'path',
                operator: 'eq',
                value: '/test',
              },
            ],
          },
        ],
        ips: [],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [], // No existing rules
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([])

      const changes = await service.getChanges(localConfig)

      expect(changes.rulesToAdd).toHaveLength(1)
      expect(changes.rulesToUpdate).toHaveLength(0)
      expect(changes.rulesToDelete).toHaveLength(0)
      expect(changes.hasChanges).toBe(true)
    })

    it('should detect IPs to add and delete', async () => {
      const localConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [
          {
            id: 'ip-new',
            ip: '192.168.1.100',
            action: 'deny',
          },
        ],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 1,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([
        {
          id: 'item-old',
          ip: '192.168.1.200', // Old IP to delete
          created_on: '2024-01-01T00:00:00Z',
          modified_on: '2024-01-01T00:00:00Z',
        },
      ])

      const changes = await service.getChanges(localConfig)

      expect(changes.ipsToAdd).toHaveLength(1)
      expect(changes.ipsToAdd?.[0]?.ip).toBe('192.168.1.100')
      expect(changes.ipsToDelete).toHaveLength(1)
      expect(changes.ipsToDelete?.[0]?.ip).toBe('192.168.1.200')
      expect(changes.hasChanges).toBe(true)
    })

    it('should detect no changes when configs match', async () => {
      // Use empty configs to test no changes scenario
      const localConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [],
      }

      const mockRuleset: CloudflareRuleset = {
        id: 'ruleset-1',
        name: 'Test Ruleset',
        description: 'Test',
        kind: 'custom',
        phase: 'http_request_firewall_custom',
        version: '1',
        rules: [],
      }

      jest.spyOn(mockClient, 'getOrCreateFirewallRuleset').mockResolvedValue(mockRuleset)
      jest.spyOn(mockClient, 'getOrCreateIPBlocklist').mockResolvedValue({
        id: 'list-1',
        name: 'Doorman IP Blocklist',
        description: 'Test',
        kind: 'ip',
        num_items: 0,
        num_referencing_filters: 0,
        created_on: '2024-01-01T00:00:00Z',
        modified_on: '2024-01-01T00:00:00Z',
      })
      jest.spyOn(mockClient, 'getListItems').mockResolvedValue([])

      const changes = await service.getChanges(localConfig)

      expect(changes.rulesToAdd).toHaveLength(0)
      expect(changes.rulesToUpdate).toHaveLength(0)
      expect(changes.rulesToDelete).toHaveLength(0)
      expect(changes.hasChanges).toBe(false)
    })
  })

  describe('getSupportedFeatures', () => {
    it('should return Cloudflare feature set', () => {
      const features = service.getSupportedFeatures()

      expect(features.supportsCustomRules).toBe(true)
      expect(features.supportsIPBlocking).toBe(true)
      expect(features.supportsRateLimiting).toBe(true)
      expect(features.supportsManagedRules).toBe(true)
      expect(features.supportsGeoBlocking).toBe(true)
      expect(features.supportsRedirect).toBe(true)
      expect(features.supportsChallenge).toBe(true)
      expect(features.maxRules).toBe(125)
    })
  })

  describe('validateConfig', () => {
    it('should validate basic config', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Test Rule',
            description: 'Test',
            enabled: true,
            action: { type: 'deny' },
            conditions: [
              {
                field: 'path',
                operator: 'eq',
                value: '/test',
              },
            ],
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should detect rule count exceeding limit', () => {
      const rules: UnifiedRule[] = Array.from({ length: 130 }, (_, i) => ({
        id: `rule-${i}`,
        name: `Rule ${i}`,
        enabled: true,
        action: { type: 'deny' },
        conditions: [{ field: 'path', operator: 'eq', value: '/test' }],
      }))

      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules,
        ips: [],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'CLOUDFLARE_RULE_LIMIT_EXCEEDED')).toBe(true)
    })

    it('should detect missing conditions', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Invalid Rule',
            enabled: true,
            action: { type: 'deny' },
            conditions: [],
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'CLOUDFLARE_RULE_NO_CONDITIONS')).toBe(true)
    })

    it('should validate rate limiting configuration', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Rate Limit Rule',
            enabled: true,
            action: {
              type: 'rate_limit',
              rateLimit: {
                requests: 0, // Invalid: must be at least 1
                window: '60s',
              },
            },
            conditions: [{ field: 'path', operator: 'eq', value: '/api' }],
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'CLOUDFLARE_INVALID_RATE_LIMIT')).toBe(true)
    })

    it('should validate rate limit window format', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Rate Limit Rule',
            enabled: true,
            action: {
              type: 'rate_limit',
              rateLimit: {
                requests: 100,
                window: 'invalid', // Invalid format
              },
            },
            conditions: [{ field: 'path', operator: 'eq', value: '/api' }],
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'CLOUDFLARE_INVALID_WINDOW_FORMAT')).toBe(true)
    })

    it('should warn about short mitigation timeout', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Rate Limit Rule',
            enabled: true,
            action: {
              type: 'rate_limit',
              rateLimit: {
                requests: 100,
                window: '60s',
                mitigationTimeout: 30, // Less than 60 seconds
              },
            },
            conditions: [{ field: 'path', operator: 'eq', value: '/api' }],
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'CLOUDFLARE_SHORT_MITIGATION_TIMEOUT')).toBe(true)
    })

    it('should validate redirect configuration', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Redirect Rule',
            enabled: true,
            action: {
              type: 'redirect',
              redirect: {
                location: '', // Missing location
                statusCode: 302,
              },
            },
            conditions: [{ field: 'path', operator: 'eq', value: '/old' }],
          },
        ],
        ips: [],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'CLOUDFLARE_REDIRECT_NO_LOCATION')).toBe(true)
    })

    it('should validate IP address format', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [
          {
            id: 'ip-1',
            ip: 'invalid-ip', // Invalid IP
            action: 'deny',
          },
        ],
      }

      const result = service.validateConfig(config)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.code === 'CLOUDFLARE_INVALID_IP')).toBe(true)
    })

    it('should warn about large IP lists without account ID', () => {
      const serviceWithoutAccount = new CloudflareFirewallService(API_TOKEN, ZONE_ID)

      const ips: UnifiedIPRule[] = Array.from({ length: 60 }, (_, i) => ({
        id: `ip-${i}`,
        ip: `192.168.1.${i}`,
        action: 'deny',
      }))

      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips,
      }

      const result = serviceWithoutAccount.validateConfig(config)

      expect(result.valid).toBe(true)
      expect(result.warnings.some((w) => w.code === 'CLOUDFLARE_LARGE_IP_LIST')).toBe(true)
    })
  })

  describe('getHealthScore', () => {
    it('should return good health score for valid config', () => {
      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [
          {
            id: 'rule-1',
            name: 'Test Rule',
            description: 'Test Description',
            enabled: true,
            action: { type: 'deny' },
            conditions: [{ field: 'path', operator: 'eq', value: '/test' }],
          },
        ],
        ips: [],
      }

      const healthScore = service.getHealthScore(config)

      expect(healthScore.score).toBeGreaterThan(70)
      expect(healthScore.grade).not.toBe('poor')
    })

    it('should warn when approaching rule limit', () => {
      const rules: UnifiedRule[] = Array.from({ length: 105 }, (_, i) => ({
        id: `rule-${i}`,
        name: `Rule ${i}`,
        description: 'Test',
        enabled: true,
        action: { type: 'deny' },
        conditions: [{ field: 'path', operator: 'eq', value: '/test' }],
      }))

      const config: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules,
        ips: [],
      }

      const healthScore = service.getHealthScore(config)

      expect(healthScore.issues.some((i) => i.category === 'limits')).toBe(true)
    })
  })

  describe('verifyCredentials', () => {
    it('should verify credentials using client', async () => {
      jest.spyOn(mockClient, 'verifyCredentials').mockResolvedValue(true)

      const result = await service.verifyCredentials()

      expect(result).toBe(true)
      expect(mockClient.verifyCredentials).toHaveBeenCalledTimes(1)
    })

    it('should return false for invalid credentials', async () => {
      jest.spyOn(mockClient, 'verifyCredentials').mockResolvedValue(false)

      const result = await service.verifyCredentials()

      expect(result).toBe(false)
    })
  })
})
