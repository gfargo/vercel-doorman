/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, beforeEach, jest } from '@jest/globals'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { FirewallConfig, CustomRule, IPBlockingRule } from '../lib/types'

// Mock the VercelClient
jest.mock('../lib/services/VercelClient')

/**
 * Tests for GitHub issue #47:
 * `vercel-doorman sync` reports "Sync completed successfully" but then fails
 * validation unless `download` is run first after adding templates.
 *
 * Root cause: After creating new rules via sync, Vercel assigns its own IDs
 * (e.g. rule_deny_word_press_ur_ls_abc123) which may differ from the local
 * template ID or the ID returned by the create API. The post-sync validation
 * compared remote rules by ID only, failing to match newly created rules
 * whose Vercel-assigned IDs didn't appear in the addedRules set or the
 * local config.
 */
describe('Sync validation after adding templates (issue #47)', () => {
  let mockClient: jest.Mocked<VercelClient>
  let firewallService: FirewallService

  const baseRemoteConfig = {
    version: 5,
    id: 'config-id',
    firewallEnabled: true,
    crs: {},
    rules: [] as CustomRule[],
    ips: [] as IPBlockingRule[],
    projectKey: 'project-key',
    ownerId: 'owner-id',
    updatedAt: '2024-01-01T00:00:00Z',
  }

  beforeEach(() => {
    mockClient = {
      fetchFirewallConfig: jest.fn(),
      createFirewallRule: jest.fn(),
      updateFirewallRule: jest.fn(),
      deleteFirewallRule: jest.fn(),
      createIPBlockingRule: jest.fn(),
      updateIPBlockingRule: jest.fn(),
      deleteIPBlockingRule: jest.fn(),
    } as any

    firewallService = new FirewallService(mockClient)
  })

  describe('validateAndUpdateConfig with newly added rules', () => {
    test('should not fail when remote rule ID differs from addedRules ID', async () => {
      // Scenario: Template adds a rule with local ID "rule_deny_word_press_ur_ls".
      // After sync, Vercel assigns "rule_deny_word_press_ur_ls_abc123".
      // The addedRules array has the API response ID which may also differ.
      const templateRule: CustomRule = {
        id: 'rule_deny_word_press_ur_ls',
        name: 'Deny WordPress URLs',
        description: 'Block common WordPress attack paths',
        conditionGroup: [
          {
            conditions: [
              {
                type: 'path',
                op: 'pre',
                value: '/wp-admin',
              },
            ],
          },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const localConfig: FirewallConfig = {
        version: 4,
        rules: [templateRule],
        ips: [],
      }

      // The API response from createFirewallRule might return a different ID
      const apiResponseRule: CustomRule = {
        ...templateRule,
        id: 'rule_deny_word_press_ur_ls_api_resp',
      }

      const syncResult = {
        addedRules: [apiResponseRule],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      // Remote config after sync has Vercel's own assigned ID (yet another ID)
      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 6,
        updatedAt: '2024-01-02T00:00:00Z',
        rules: [
          {
            ...templateRule,
            id: 'rule_deny_word_press_ur_ls_xyz789', // Vercel-assigned ID
          },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      // Should NOT throw - the rule content matches even though IDs differ
      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      expect(result.version).toBe(6)
      expect(result.updatedAt).toBe('2024-01-02T00:00:00Z')
    })

    test('should update local rule IDs with remote-assigned IDs after sync', async () => {
      const templateRule: CustomRule = {
        id: 'rule_block_bad_bots',
        name: 'Block Bad Bots',
        description: 'Block known bad bot user agents',
        conditionGroup: [
          {
            conditions: [
              {
                type: 'user_agent',
                op: 'inc',
                value: ['BadBot', 'EvilCrawler'],
              },
            ],
          },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const localConfig: FirewallConfig = {
        version: 4,
        rules: [templateRule],
        ips: [],
      }

      const syncResult = {
        addedRules: [{ ...templateRule, id: 'rule_block_bad_bots_resp' }],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      const remoteAssignedId = 'rule_block_bad_bots_vercel123'
      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 6,
        rules: [
          {
            ...templateRule,
            id: remoteAssignedId,
          },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      // The returned config should have the remote-assigned ID
      expect(result.rules[0]!.id).toBe(remoteAssignedId)
    })

    test('should handle multiple templates added at once', async () => {
      const wordpressRule: CustomRule = {
        id: 'rule_deny_word_press_ur_ls',
        name: 'Deny WordPress URLs',
        conditionGroup: [
          { conditions: [{ type: 'path', op: 'pre', value: '/wp-admin' }] },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const badBotsRule: CustomRule = {
        id: 'rule_block_bad_bots',
        name: 'Block Bad Bots',
        conditionGroup: [
          { conditions: [{ type: 'user_agent', op: 'inc', value: ['BadBot'] }] },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const aiBotsRule: CustomRule = {
        id: 'rule_block_ai_bots',
        name: 'Block AI Bots',
        conditionGroup: [
          { conditions: [{ type: 'user_agent', op: 'inc', value: ['GPTBot'] }] },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const localConfig: FirewallConfig = {
        version: 4,
        rules: [wordpressRule, badBotsRule, aiBotsRule],
        ips: [],
      }

      const syncResult = {
        addedRules: [
          { ...wordpressRule, id: 'rule_deny_word_press_ur_ls_resp' },
          { ...badBotsRule, id: 'rule_block_bad_bots_resp' },
          { ...aiBotsRule, id: 'rule_block_ai_bots_resp' },
        ],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      // Remote has all three rules with Vercel-assigned IDs
      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 7,
        rules: [
          { ...wordpressRule, id: 'rule_deny_word_press_ur_ls_v1' },
          { ...badBotsRule, id: 'rule_block_bad_bots_v1' },
          { ...aiBotsRule, id: 'rule_block_ai_bots_v1' },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      expect(result.version).toBe(7)
      expect(result.rules).toHaveLength(3)
      // All rules should have their remote-assigned IDs
      expect(result.rules[0]!.id).toBe('rule_deny_word_press_ur_ls_v1')
      expect(result.rules[1]!.id).toBe('rule_block_bad_bots_v1')
      expect(result.rules[2]!.id).toBe('rule_block_ai_bots_v1')
    })

    test('should handle mix of existing and newly added rules', async () => {
      const existingRule: CustomRule = {
        id: 'rule_existing_rule',
        name: 'Existing Rule',
        conditionGroup: [
          { conditions: [{ type: 'path', op: 'eq', value: '/existing' }] },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const newTemplateRule: CustomRule = {
        id: 'rule_deny_word_press_ur_ls',
        name: 'Deny WordPress URLs',
        conditionGroup: [
          { conditions: [{ type: 'path', op: 'pre', value: '/wp-admin' }] },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const localConfig: FirewallConfig = {
        version: 4,
        rules: [existingRule, newTemplateRule],
        ips: [],
      }

      const syncResult = {
        addedRules: [{ ...newTemplateRule, id: 'rule_deny_word_press_ur_ls_resp' }],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 6,
        rules: [
          existingRule, // Existing rule unchanged
          { ...newTemplateRule, id: 'rule_deny_word_press_ur_ls_v1' }, // New rule with Vercel ID
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      expect(result.version).toBe(6)
      expect(result.rules).toHaveLength(2)
      // Existing rule keeps its ID
      expect(result.rules[0]!.id).toBe('rule_existing_rule')
      // New rule gets the remote-assigned ID
      expect(result.rules[1]!.id).toBe('rule_deny_word_press_ur_ls_v1')
    })

    test('should handle newly added IP rules with Vercel-assigned IDs', async () => {
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [],
        ips: [
          {
            ip: '10.0.0.1',
            hostname: 'blocked-host',
            action: 'deny' as const,
          },
        ],
      }

      const syncResult = {
        addedRules: [],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [
          {
            id: 'ip-resp-id',
            ip: '10.0.0.1',
            hostname: 'blocked-host',
            action: 'deny' as const,
          },
        ],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 6,
        ips: [
          {
            id: 'ip-vercel-assigned-id', // Different from API response ID
            ip: '10.0.0.1',
            hostname: 'blocked-host',
            action: 'deny' as const,
          },
        ] as IPBlockingRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      // Should NOT throw
      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      expect(result.version).toBe(6)
      expect(result.ips![0]!.id).toBe('ip-vercel-assigned-id')
    })

    test('should still detect genuinely unexpected rules', async () => {
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [],
        ips: [],
      }

      const syncResult = {
        addedRules: [],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      // Remote has a rule that doesn't exist locally and wasn't part of sync
      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 6,
        rules: [
          {
            id: 'rule_totally_unknown',
            name: 'Unknown Rule',
            conditionGroup: [
              { conditions: [{ type: 'path', op: 'eq', value: '/unknown' }] },
            ],
            action: { mitigate: { action: 'deny' } },
            active: true,
          },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      await expect(
        firewallService.validateAndUpdateConfig(localConfig, syncResult),
      ).rejects.toThrow('Firewall configuration validation failed')
    })

    test('should match rules with stale local IDs by content', async () => {
      // Scenario: Local config has a rule from a previous session with a stale ID,
      // but the content matches a remote rule with a different ID.
      const localRule: CustomRule = {
        id: 'rule_stale_local_id',
        name: 'My Rule',
        conditionGroup: [
          { conditions: [{ type: 'path', op: 'eq', value: '/my-path' }] },
        ],
        action: { mitigate: { action: 'deny' } },
        active: true,
      }

      const localConfig: FirewallConfig = {
        version: 4,
        rules: [localRule],
        ips: [],
      }

      const syncResult = {
        addedRules: [],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      // Remote has the same rule content but with a different (Vercel-assigned) ID
      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 6,
        rules: [
          {
            ...localRule,
            id: 'rule_my_rule_vercel456',
          },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      // Should NOT throw - content matches even though IDs differ
      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      expect(result.version).toBe(6)
      // The local rule should be updated with the remote ID
      expect(result.rules[0]!.id).toBe('rule_my_rule_vercel456')
    })

    test('should not assign the same remote ID to multiple local rules with identical content', async () => {
      // Edge case: two local rules with identical content but different IDs.
      // Each should get its own unique remote-assigned ID.
      const ruleContent = {
        name: 'Deny Path',
        conditionGroup: [
          { conditions: [{ type: 'path' as const, op: 'eq' as const, value: '/blocked' }] },
        ],
        action: { mitigate: { action: 'deny' as const } },
        active: true,
      }

      const localRuleA: CustomRule = { ...ruleContent, id: 'rule_a' }
      const localRuleB: CustomRule = { ...ruleContent, id: 'rule_b' }

      const localConfig: FirewallConfig = {
        version: 4,
        rules: [localRuleA, localRuleB],
        ips: [],
      }

      const syncResult = {
        addedRules: [
          { ...ruleContent, id: 'rule_a_resp' },
          { ...ruleContent, id: 'rule_b_resp' },
        ],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      const remoteAfterSync = {
        ...baseRemoteConfig,
        version: 6,
        rules: [
          { ...ruleContent, id: 'rule_a_vercel' },
          { ...ruleContent, id: 'rule_b_vercel' },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteAfterSync)

      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      // Each local rule should get a distinct remote ID
      expect(result.rules[0]!.id).toBe('rule_a_vercel')
      expect(result.rules[1]!.id).toBe('rule_b_vercel')
      expect(result.rules[0]!.id).not.toBe(result.rules[1]!.id)
    })

    test('should skip validation in dry run mode', async () => {
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [],
        ips: [],
      }

      const syncResult = {
        addedRules: [],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult, { dryRun: true })

      expect(result).toBe(localConfig)
      expect(mockClient.fetchFirewallConfig).not.toHaveBeenCalled()
    })
  })
})
