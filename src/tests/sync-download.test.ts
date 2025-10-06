/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, beforeEach, jest } from '@jest/globals'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { FirewallConfig, CustomRule, IPBlockingRule } from '../lib/types'

// Mock the VercelClient
jest.mock('../lib/services/VercelClient')

describe('Sync and Download Logic', () => {
  let mockClient: jest.Mocked<VercelClient>
  let firewallService: FirewallService

  const mockRemoteConfig = {
    version: 5,
    id: 'config-id',
    firewallEnabled: true,
    crs: {},
    rules: [
      {
        id: 'rule_existing_rule',
        name: 'Existing Rule',
        description: 'An existing rule',
        conditionGroup: [
          {
            conditions: [
              {
                type: 'path' as const,
                op: 'eq' as const,
                value: '/existing',
              },
            ],
          },
        ],
        action: {
          mitigate: {
            action: 'deny' as const,
          },
        },
        active: true,
      },
    ] as CustomRule[],
    ips: [
      {
        id: 'ip-rule-1',
        ip: '192.168.1.100',
        hostname: 'existing-host',
        action: 'deny' as const,
      },
    ] as IPBlockingRule[],
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

  describe('Version Synchronization', () => {
    test('should detect version mismatch between local and remote', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 3, // Older version
        rules: [],
        ips: [],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(mockRemoteConfig)

      // When
      const changes = await firewallService.getChanges(localConfig)

      // Then
      expect(changes.version).toBe(5)
      expect(changes.version).not.toBe(localConfig.version)
    })

    test('should handle missing version in local config', async () => {
      // Given
      const localConfig: FirewallConfig = {
        rules: [],
        ips: [],
        // No version property
      } as any

      mockClient.fetchFirewallConfig.mockResolvedValue(mockRemoteConfig)

      // When
      const changes = await firewallService.getChanges(localConfig)

      // Then
      expect(changes.version).toBe(5)
    })
  })

  describe('Rule Diffing Logic', () => {
    test('should correctly identify rules to add, update, and delete', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [
          {
            id: 'rule_existing_rule',
            name: 'Existing Rule',
            description: 'Modified description', // Changed
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/existing',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          },
          {
            id: 'rule_new_rule',
            name: 'New Rule',
            description: 'A new rule to add',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/new',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          },
        ],
        ips: [],
      }

      const remoteConfigWithExtraRule = {
        ...mockRemoteConfig,
        rules: [
          ...mockRemoteConfig.rules,
          {
            id: 'rule_to_delete',
            name: 'Rule to Delete',
            description: 'This rule should be deleted',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/delete',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteConfigWithExtraRule)

      // When
      const changes = await firewallService.getChanges(localConfig)

      // Then
      expect(changes.toAdd).toHaveLength(1)
      expect(changes.toAdd[0]?.name).toBe('New Rule')

      expect(changes.toUpdate).toHaveLength(1)
      expect(changes.toUpdate[0]?.name).toBe('Existing Rule')

      expect(changes.toDelete).toHaveLength(1)
      expect(changes.toDelete[0]?.name).toBe('Rule to Delete')
    })

    test('should handle IP blocking rules correctly', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [],
        ips: [
          {
            id: 'ip-rule-1',
            ip: '192.168.1.100',
            hostname: 'modified-host', // Changed
            action: 'deny' as const,
          },
          {
            ip: '10.0.0.1', // New IP rule without ID
            hostname: 'new-host',
            action: 'deny' as const,
          },
        ],
      }

      const remoteConfigWithExtraIP = {
        ...mockRemoteConfig,
        ips: [
          ...mockRemoteConfig.ips,
          {
            id: 'ip-rule-to-delete',
            ip: '172.16.0.1',
            hostname: 'delete-host',
            action: 'deny' as const,
          },
        ] as IPBlockingRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(remoteConfigWithExtraIP)

      // When
      const changes = await firewallService.getChanges(localConfig)

      // Then
      expect(changes.ipsToAdd).toHaveLength(1)
      expect(changes.ipsToAdd[0]?.ip).toBe('10.0.0.1')

      expect(changes.ipsToUpdate).toHaveLength(1)
      expect(changes.ipsToUpdate[0]?.hostname).toBe('modified-host')

      expect(changes.ipsToDelete).toHaveLength(1)
      expect(changes.ipsToDelete[0]?.ip).toBe('172.16.0.1')
    })
  })

  describe('Sync Operation', () => {
    test('should perform sync operations in correct order', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [
          {
            id: 'rule_new_rule',
            name: 'New Rule',
            description: 'A new rule',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/new',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          },
        ],
        ips: [],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(mockRemoteConfig)
      mockClient.deleteFirewallRule.mockResolvedValue(undefined as any)
      mockClient.createFirewallRule.mockResolvedValue({
        ...localConfig.rules[0],
        id: 'rule_new_rule',
      } as CustomRule)

      // When
      const result = await firewallService.syncRules(localConfig)

      // Then
      // Should delete first, then add
      expect(mockClient.deleteFirewallRule).toHaveBeenCalledWith(mockRemoteConfig.rules[0])
      expect(mockClient.createFirewallRule).toHaveBeenCalledWith(localConfig.rules[0])

      expect(result.deletedRules).toHaveLength(1)
      expect(result.addedRules).toHaveLength(1)
    })

    test('should handle rule ID mismatches', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [
          {
            id: 'wrong-id', // Wrong ID format
            name: 'Test Rule',
            description: 'A test rule',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/test',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          },
        ],
        ips: [],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue({ ...mockRemoteConfig, rules: [] })
      mockClient.createFirewallRule.mockResolvedValue({
        ...localConfig.rules[0],
        id: 'rule_test_rule', // Correct snake_case ID
      } as CustomRule)

      // When
      const result = await firewallService.syncRules(localConfig)

      // Then
      expect(result.rulesToUpdateLocally).toHaveLength(1)
      expect(result.rulesToUpdateLocally[0]).toEqual({
        oldId: 'wrong-id',
        newId: 'rule_test_rule',
        name: 'Test Rule',
      })
    })
  })

  describe('Validation After Sync', () => {
    test('should validate config after successful sync', async () => {
      // Given - Config that matches remote after sync
      const localConfig: FirewallConfig = {
        version: 4,
        rules: mockRemoteConfig.rules, // Include the rules that exist remotely
        ips: mockRemoteConfig.ips, // Include the IPs that exist remotely
      }

      const syncResult = {
        addedRules: [],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      const updatedRemoteConfig = {
        ...mockRemoteConfig,
        version: 6, // New version after sync
        updatedAt: '2024-01-02T00:00:00Z',
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(updatedRemoteConfig)

      // When
      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      // Then
      expect(result.version).toBe(6)
      expect(result.updatedAt).toBe('2024-01-02T00:00:00Z')
    })

    test('should throw error if validation fails', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 4,
        rules: [
          {
            id: 'rule_test',
            name: 'Test Rule',
            description: 'Test',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/test',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          },
        ],
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

      // Remote config has unexpected rule
      const unexpectedRemoteConfig = {
        ...mockRemoteConfig,
        rules: [
          {
            id: 'rule_unexpected',
            name: 'Unexpected Rule',
            description: 'This should not exist',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/unexpected',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          },
        ] as CustomRule[],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(unexpectedRemoteConfig)

      // When/Then
      await expect(firewallService.validateAndUpdateConfig(localConfig, syncResult)).rejects.toThrow(
        'Firewall configuration validation failed',
      )
    })
  })

  describe('Edge Cases', () => {
    test('should handle empty configurations', async () => {
      // Given
      const emptyConfig: FirewallConfig = {
        version: 1,
        rules: [],
        ips: [],
      }

      const emptyRemoteConfig = {
        ...mockRemoteConfig,
        rules: [],
        ips: [],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(emptyRemoteConfig)

      // When
      const changes = await firewallService.getChanges(emptyConfig)

      // Then
      expect(changes.toAdd).toHaveLength(0)
      expect(changes.toUpdate).toHaveLength(0)
      expect(changes.toDelete).toHaveLength(0)
      expect(changes.ipsToAdd).toHaveLength(0)
      expect(changes.ipsToUpdate).toHaveLength(0)
      expect(changes.ipsToDelete).toHaveLength(0)
    })

    test('should handle rules without IDs', async () => {
      // Given
      const configWithoutIds: FirewallConfig = {
        version: 4,
        rules: [
          {
            // No ID property
            name: 'Rule Without ID',
            description: 'Test rule',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/test',
                  },
                ],
              },
            ],
            action: {
              mitigate: {
                action: 'deny' as const,
              },
            },
            active: true,
          } as any,
        ],
        ips: [],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue({ ...mockRemoteConfig, rules: [] })

      // When
      const changes = await firewallService.getChanges(configWithoutIds)

      // Then
      expect(changes.toAdd).toHaveLength(1)
      expect(changes.toAdd[0]?.name).toBe('Rule Without ID')
    })
  })
})
