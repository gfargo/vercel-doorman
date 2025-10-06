/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, beforeEach, jest } from '@jest/globals'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { FirewallConfig, CustomRule, IPBlockingRule } from '../lib/types'

// Mock the VercelClient
jest.mock('../lib/services/VercelClient')

describe('Edge Cases and Error Scenarios', () => {
  let mockClient: jest.Mocked<VercelClient>
  let firewallService: FirewallService

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

  describe('Network and API Errors', () => {
    test('should handle network timeout during fetch', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
        rules: [],
        ips: [],
      }

      mockClient.fetchFirewallConfig.mockRejectedValue(new Error('Network timeout'))

      // When/Then
      await expect(firewallService.getChanges(localConfig)).rejects.toThrow(
        'Failed to fetch existing firewall configuration',
      )
    })

    test('should handle API rate limiting during sync', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
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

      mockClient.fetchFirewallConfig.mockResolvedValue({
        version: 2,
        id: 'config-id',
        firewallEnabled: true,
        crs: {},
        rules: [],
        ips: [],
        projectKey: 'project-key',
        ownerId: 'owner-id',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      // Simulate rate limiting error
      mockClient.createFirewallRule.mockRejectedValue(new Error('Rate limit exceeded'))

      // When/Then
      await expect(firewallService.syncRules(localConfig)).rejects.toThrow('Failed to synchronize firewall rules')
    })

    test('should handle partial sync failures', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
        rules: [
          {
            id: 'rule_success',
            name: 'Success Rule',
            description: 'This should succeed',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/success',
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
            id: 'rule_failure',
            name: 'Failure Rule',
            description: 'This should fail',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/failure',
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

      mockClient.fetchFirewallConfig.mockResolvedValue({
        version: 2,
        id: 'config-id',
        firewallEnabled: true,
        crs: {},
        rules: [],
        ips: [],
        projectKey: 'project-key',
        ownerId: 'owner-id',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      // First rule succeeds, second fails
      mockClient.createFirewallRule
        .mockResolvedValueOnce(localConfig.rules[0] as CustomRule)
        .mockRejectedValueOnce(new Error('Invalid rule configuration'))

      // When/Then
      await expect(firewallService.syncRules(localConfig)).rejects.toThrow('Failed to synchronize firewall rules')
    })
  })

  describe('Data Consistency Issues', () => {
    test('should handle rules with duplicate IDs', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
        rules: [
          {
            id: 'rule_duplicate',
            name: 'First Rule',
            description: 'First rule with duplicate ID',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/first',
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
            id: 'rule_duplicate', // Same ID
            name: 'Second Rule',
            description: 'Second rule with duplicate ID',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/second',
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

      mockClient.fetchFirewallConfig.mockResolvedValue({
        version: 2,
        id: 'config-id',
        firewallEnabled: true,
        crs: {},
        rules: [],
        ips: [],
        projectKey: 'project-key',
        ownerId: 'owner-id',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      // When
      const changes = await firewallService.getChanges(localConfig)

      // Then - Both rules are added (system doesn't currently deduplicate by ID)
      expect(changes.toAdd).toHaveLength(2)
      expect(changes.toAdd[0]?.name).toBe('First Rule')
      expect(changes.toAdd[1]?.name).toBe('Second Rule')
    })

    test('should handle malformed rule conditions', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
        rules: [
          {
            id: 'rule_malformed',
            name: 'Malformed Rule',
            description: 'Rule with malformed conditions',
            conditionGroup: [
              {
                conditions: [], // Empty conditions array
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

      // When/Then - Should fail validation
      await expect(firewallService.getChanges(localConfig)).rejects.toThrow('Invalid firewall configuration')
    })

    test('should handle IP rules without proper IP format', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
        rules: [],
        ips: [
          {
            ip: 'not-an-ip-address', // Invalid IP
            hostname: 'test-host',
            action: 'deny' as const,
          },
        ],
      }

      // When/Then - Should fail validation
      await expect(firewallService.getChanges(localConfig)).rejects.toThrow('Invalid firewall configuration')
    })
  })

  describe('Validation Edge Cases', () => {
    test('should handle validation failure after successful sync', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
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
        addedRules: [localConfig.rules[0] as CustomRule],
        updatedRules: [],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      // Mock successful sync but validation shows unexpected state
      mockClient.fetchFirewallConfig.mockResolvedValue({
        version: 3,
        id: 'config-id',
        firewallEnabled: true,
        crs: {},
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
        ips: [],
        projectKey: 'project-key',
        ownerId: 'owner-id',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      // When/Then
      await expect(firewallService.validateAndUpdateConfig(localConfig, syncResult)).rejects.toThrow(
        'Firewall configuration validation failed',
      )
    })

    test('should handle slow API responses during validation', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
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

      // Mock slow response that eventually succeeds
      mockClient.fetchFirewallConfig.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => {
              resolve({
                version: 2,
                id: 'config-id',
                firewallEnabled: true,
                crs: {},
                rules: [],
                ips: [],
                projectKey: 'project-key',
                ownerId: 'owner-id',
                updatedAt: '2024-01-01T00:00:00Z',
              })
            }, 100) // 100ms delay
          }),
      )

      // When
      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      // Then
      expect(result.version).toBe(2)
    })
  })

  describe('Concurrent Modification Scenarios', () => {
    test('should handle rules modified by another process during sync', async () => {
      // Given
      const localConfig: FirewallConfig = {
        version: 1,
        rules: [
          {
            id: 'rule_test',
            name: 'Test Rule',
            description: 'Original description',
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

      // Initial fetch shows rule exists
      const initialRemoteConfig = {
        version: 2,
        id: 'config-id',
        firewallEnabled: true,
        crs: {},
        rules: [
          {
            ...localConfig.rules[0],
            description: 'Remote description', // Different description
          },
        ] as CustomRule[],
        ips: [],
        projectKey: 'project-key',
        ownerId: 'owner-id',
        updatedAt: '2024-01-01T00:00:00Z',
      }

      // Validation fetch shows rule was modified by another process
      const validationRemoteConfig = {
        ...initialRemoteConfig,
        version: 3,
        rules: [
          {
            ...localConfig.rules[0],
            description: 'Modified by another process', // Changed again
          },
        ] as CustomRule[],
        updatedAt: '2024-01-01T01:00:00Z',
      }

      mockClient.fetchFirewallConfig.mockResolvedValue(validationRemoteConfig)

      mockClient.updateFirewallRule.mockResolvedValue(localConfig.rules[0] as CustomRule)

      const syncResult = {
        addedRules: [],
        updatedRules: [localConfig.rules[0] as CustomRule],
        deletedRules: [],
        addedIPRules: [],
        updatedIPRules: [],
        deletedIPRules: [],
      }

      // When - System doesn't currently validate updated rules match expected state
      const result = await firewallService.validateAndUpdateConfig(localConfig, syncResult)

      // Then - Validation passes and returns updated config with new version
      expect(result.version).toBe(3)
      expect(result.updatedAt).toBe('2024-01-01T01:00:00Z')
    })
  })

  describe('Large Configuration Handling', () => {
    test('should handle configurations with many rules', async () => {
      // Given - Create a config with 100 rules
      const manyRules: CustomRule[] = Array.from({ length: 100 }, (_, i) => ({
        id: `rule_test_rule_${i}`,
        name: `Test Rule ${i}`,
        description: `Test rule number ${i}`,
        conditionGroup: [
          {
            conditions: [
              {
                type: 'path' as const,
                op: 'eq' as const,
                value: `/test/${i}`,
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
      }))

      const localConfig: FirewallConfig = {
        version: 1,
        rules: manyRules,
        ips: [],
      }

      mockClient.fetchFirewallConfig.mockResolvedValue({
        version: 2,
        id: 'config-id',
        firewallEnabled: true,
        crs: {},
        rules: [],
        ips: [],
        projectKey: 'project-key',
        ownerId: 'owner-id',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      // When
      const changes = await firewallService.getChanges(localConfig)

      // Then
      expect(changes.toAdd).toHaveLength(100)
      expect(changes.toUpdate).toHaveLength(0)
      expect(changes.toDelete).toHaveLength(0)
    })

    test('should handle configurations with many IP rules', async () => {
      // Given - Create a config with 50 IP rules
      const manyIPs: IPBlockingRule[] = Array.from({ length: 50 }, (_, i) => ({
        ip: `192.168.1.${i + 1}`,
        hostname: `host-${i}`,
        action: 'deny' as const,
      }))

      const localConfig: FirewallConfig = {
        version: 1,
        rules: [],
        ips: manyIPs,
      }

      mockClient.fetchFirewallConfig.mockResolvedValue({
        version: 2,
        id: 'config-id',
        firewallEnabled: true,
        crs: {},
        rules: [],
        ips: [],
        projectKey: 'project-key',
        ownerId: 'owner-id',
        updatedAt: '2024-01-01T00:00:00Z',
      })

      // When
      const changes = await firewallService.getChanges(localConfig)

      // Then
      expect(changes.ipsToAdd).toHaveLength(50)
      expect(changes.ipsToUpdate).toHaveLength(0)
      expect(changes.ipsToDelete).toHaveLength(0)
    })
  })
})
