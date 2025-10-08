/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, test, beforeEach, afterEach, jest } from '@jest/globals'
import { promises as fs } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { handler as listHandler } from '../commands/list'
import { handler as statusHandler } from '../commands/status'
import { handler as diffHandler } from '../commands/diff'
import { handler as validateHandler } from '../commands/validate'
import type { UnifiedConfig } from '../lib/types/unified'

// Mock external dependencies
jest.mock('../lib/services/VercelClient')
jest.mock('../lib/providers/cloudflare/CloudflareClient')
jest.mock('../lib/ui/prompt')
jest.mock('../lib/ui/promptForCredentials')

describe('Multi-Provider Integration Tests', () => {
  let tempDir: string
  let vercelConfigPath: string
  let cloudflareConfigPath: string

  const mockVercelRemoteConfig = {
    version: 5,
    id: 'config-id',
    firewallEnabled: true,
    crs: {},
    rules: [
      {
        id: 'rule_vercel_test',
        name: 'Vercel Test Rule',
        description: 'A test rule for Vercel',
        conditionGroup: [
          {
            conditions: [
              {
                type: 'path' as const,
                op: 'eq' as const,
                value: '/api/test',
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
    ips: [
      {
        id: 'ip-vercel-1',
        ip: '192.168.1.100',
        hostname: 'vercel-test',
        action: 'deny' as const,
      },
    ],
    projectKey: 'project-key',
    ownerId: 'owner-id',
    updatedAt: '2024-01-01T12:00:00Z',
  }

  const mockCloudflareRuleset = {
    id: 'ruleset-cf-test',
    name: 'Doorman Custom Firewall Rules',
    description: 'Custom firewall rules managed by Vercel Doorman',
    kind: 'custom' as const,
    version: '3',
    phase: 'http_request_firewall_custom' as const,
    last_updated: '2024-01-01T12:00:00Z',
    rules: [
      {
        id: 'rule_cf_test',
        version: '1',
        action: 'block' as const,
        expression: '(http.request.uri.path eq "/api/test")',
        description: 'Cloudflare Test Rule',
        enabled: true,
        last_updated: '2024-01-01T12:00:00Z',
      },
      {
        id: 'rule_cf_ip',
        version: '1',
        action: 'block' as const,
        expression: 'ip.src eq 10.0.0.1',
        description: 'Block IP 10.0.0.1 (cf-test)',
        enabled: true,
        last_updated: '2024-01-01T12:00:00Z',
      },
    ],
  }

  beforeEach(async () => {
    // Create temporary directory for test configs
    tempDir = await fs.mkdtemp(join(tmpdir(), 'vercel-doorman-multiprovider-test-'))
    vercelConfigPath = join(tempDir, 'vercel-config.json')
    cloudflareConfigPath = join(tempDir, 'cloudflare-config.json')

    // Mock process.exit to prevent it from killing Jest workers
    jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
      throw new Error(`process.exit called with "${code}"`)
    })

    // Mock the prompt functions
    const { prompt } = await import('../lib/ui/prompt')
    const { promptForCredentials } = await import('../lib/ui/promptForCredentials')

    ;(prompt as jest.MockedFunction<typeof prompt>).mockResolvedValue(true)
    ;(promptForCredentials as jest.MockedFunction<typeof promptForCredentials>).mockResolvedValue({
      token: 'test-token',
      projectId: 'test-project',
      teamId: 'test-team',
    })

    // Mock VercelClient
    const { VercelClient } = await import('../lib/services/VercelClient')
    const MockedVercelClient = VercelClient as jest.MockedClass<typeof VercelClient>

    // @ts-expect-error - Mock type compatibility
    MockedVercelClient.prototype.fetchFirewallConfig = jest.fn().mockResolvedValue(mockVercelRemoteConfig)

    // Mock CloudflareClient
    const { CloudflareClient } = await import('../lib/providers/cloudflare/CloudflareClient')
    const MockedCloudflareClient = CloudflareClient as jest.MockedClass<typeof CloudflareClient>

    // @ts-expect-error - Mock type compatibility
    MockedCloudflareClient.prototype.getOrCreateFirewallRuleset = jest.fn().mockResolvedValue(mockCloudflareRuleset)
    // @ts-expect-error - Mock type compatibility
    MockedCloudflareClient.prototype.listRulesets = jest.fn().mockResolvedValue([mockCloudflareRuleset])
    // @ts-expect-error - Mock type compatibility
    MockedCloudflareClient.prototype.getRuleset = jest.fn().mockResolvedValue(mockCloudflareRuleset)
    // @ts-expect-error - Mock type compatibility
    MockedCloudflareClient.prototype.verifyCredentials = jest.fn().mockResolvedValue(true)
    // @ts-expect-error - Mock type compatibility
    MockedCloudflareClient.prototype.getZoneInfo = jest.fn().mockResolvedValue({
      id: 'test-zone-id',
      name: 'example.com',
    })
  })

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true })
    jest.clearAllMocks()
    jest.restoreAllMocks()
  })

  describe('Provider Auto-Detection', () => {
    test('should detect Vercel provider from legacy config', async () => {
      // Given - Legacy Vercel config
      const legacyVercelConfig = {
        version: 5,
        projectId: 'test-project',
        teamId: 'test-team',
        rules: [],
        ips: [],
      }

      await fs.writeFile(vercelConfigPath, JSON.stringify(legacyVercelConfig, null, 2))

      // When - Run list command
      await listHandler({
        config: vercelConfigPath,
        format: 'json',
        debug: false,
        ci: true,
      } as any)

      // Then - Should use Vercel client
      const { VercelClient } = await import('../lib/services/VercelClient')
      expect(VercelClient.prototype.fetchFirewallConfig).toHaveBeenCalled()
    })

    test('should detect Cloudflare provider from unified config', async () => {
      // Given - Unified config with provider field
      const unifiedCloudflareConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
            accountId: 'test-account-id',
          },
        },
        rules: [],
        ips: [],
      }

      await fs.writeFile(cloudflareConfigPath, JSON.stringify(unifiedCloudflareConfig, null, 2))

      // Set environment variables for Cloudflare
      process.env.CLOUDFLARE_API_TOKEN = 'test-cf-token'
      process.env.CLOUDFLARE_ZONE_ID = 'test-zone-id'

      // When - Run list command
      await listHandler({
        config: cloudflareConfigPath,
        format: 'json',
        debug: false,
        ci: true,
      } as any)

      // Then - Should use Cloudflare client
      const { CloudflareClient } = await import('../lib/providers/cloudflare/CloudflareClient')
      expect(CloudflareClient.prototype.getOrCreateFirewallRuleset).toHaveBeenCalled()

      // Clean up
      delete process.env.CLOUDFLARE_API_TOKEN
      delete process.env.CLOUDFLARE_ZONE_ID
    })
  })

  describe('List Command - Multi-Provider', () => {
    test('should list rules from Vercel', async () => {
      // Given
      const legacyVercelConfig = {
        version: 5,
        projectId: 'test-project',
        teamId: 'test-team',
        rules: [],
        ips: [],
      }

      await fs.writeFile(vercelConfigPath, JSON.stringify(legacyVercelConfig, null, 2))

      // When
      await listHandler({
        config: vercelConfigPath,
        format: 'json',
        debug: false,
        ci: true,
      } as any)

      // Then
      const { VercelClient } = await import('../lib/services/VercelClient')
      expect(VercelClient.prototype.fetchFirewallConfig).toHaveBeenCalled()
    })

    test('should list rules from Cloudflare', async () => {
      // Given
      const unifiedCloudflareConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
          },
        },
        rules: [],
        ips: [],
      }

      await fs.writeFile(cloudflareConfigPath, JSON.stringify(unifiedCloudflareConfig, null, 2))

      process.env.CLOUDFLARE_API_TOKEN = 'test-cf-token'
      process.env.CLOUDFLARE_ZONE_ID = 'test-zone-id'

      // When
      await listHandler({
        config: cloudflareConfigPath,
        format: 'json',
        debug: false,
        ci: true,
      } as any)

      // Then
      const { CloudflareClient } = await import('../lib/providers/cloudflare/CloudflareClient')
      expect(CloudflareClient.prototype.getOrCreateFirewallRuleset).toHaveBeenCalled()

      // Clean up
      delete process.env.CLOUDFLARE_API_TOKEN
      delete process.env.CLOUDFLARE_ZONE_ID
    })
  })

  describe('Status Command - Multi-Provider', () => {
    test('should show status for Vercel configuration', async () => {
      // Given
      const legacyVercelConfig = {
        version: 5,
        projectId: 'test-project',
        teamId: 'test-team',
        rules: mockVercelRemoteConfig.rules,
        ips: mockVercelRemoteConfig.ips,
      }

      await fs.writeFile(vercelConfigPath, JSON.stringify(legacyVercelConfig, null, 2))

      // When
      await statusHandler({
        config: vercelConfigPath,
        debug: false,
        ci: true,
      } as any)

      // Then
      const { VercelClient } = await import('../lib/services/VercelClient')
      expect(VercelClient.prototype.fetchFirewallConfig).toHaveBeenCalled()
    })

    test('should show status for Cloudflare configuration', async () => {
      // Given
      const unifiedCloudflareConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
          },
        },
        rules: [],
        ips: [],
      }

      await fs.writeFile(cloudflareConfigPath, JSON.stringify(unifiedCloudflareConfig, null, 2))

      process.env.CLOUDFLARE_API_TOKEN = 'test-cf-token'
      process.env.CLOUDFLARE_ZONE_ID = 'test-zone-id'

      // When
      await statusHandler({
        config: cloudflareConfigPath,
        debug: false,
        ci: true,
      } as any)

      // Then
      const { CloudflareClient } = await import('../lib/providers/cloudflare/CloudflareClient')
      expect(CloudflareClient.prototype.getOrCreateFirewallRuleset).toHaveBeenCalled()

      // Clean up
      delete process.env.CLOUDFLARE_API_TOKEN
      delete process.env.CLOUDFLARE_ZONE_ID
    })
  })

  describe('Diff Command - Multi-Provider', () => {
    test('should calculate diff for Vercel configuration', async () => {
      // Given
      const legacyVercelConfig = {
        version: 4, // Different from remote
        projectId: 'test-project',
        teamId: 'test-team',
        rules: [
          {
            id: 'rule_local_rule',
            name: 'Local Rule',
            description: 'Local only',
            conditionGroup: [
              {
                conditions: [
                  {
                    type: 'path' as const,
                    op: 'eq' as const,
                    value: '/local',
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

      await fs.writeFile(vercelConfigPath, JSON.stringify(legacyVercelConfig, null, 2))

      // When
      await diffHandler({
        config: vercelConfigPath,
        format: 'json',
        debug: false,
        ci: true,
      } as any)

      // Then
      const { VercelClient } = await import('../lib/services/VercelClient')
      expect(VercelClient.prototype.fetchFirewallConfig).toHaveBeenCalled()
    })

    test('should calculate diff for Cloudflare configuration', async () => {
      // Given
      const unifiedCloudflareConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
          },
        },
        rules: [
          {
            id: 'rule_local_cf',
            name: 'Local CF Rule',
            description: 'Local Cloudflare rule',
            conditions: [
              {
                field: 'path',
                operator: 'eq',
                value: '/local',
              },
            ],
            action: {
              type: 'deny',
            },
            enabled: true,
          },
        ],
        ips: [],
      }

      await fs.writeFile(cloudflareConfigPath, JSON.stringify(unifiedCloudflareConfig, null, 2))

      process.env.CLOUDFLARE_API_TOKEN = 'test-cf-token'
      process.env.CLOUDFLARE_ZONE_ID = 'test-zone-id'

      // When
      await diffHandler({
        config: cloudflareConfigPath,
        format: 'json',
        debug: false,
        ci: true,
      } as any)

      // Then
      const { CloudflareClient } = await import('../lib/providers/cloudflare/CloudflareClient')
      expect(CloudflareClient.prototype.getOrCreateFirewallRuleset).toHaveBeenCalled()

      // Clean up
      delete process.env.CLOUDFLARE_API_TOKEN
      delete process.env.CLOUDFLARE_ZONE_ID
    })
  })

  describe('Validate Command - Multi-Provider', () => {
    test('should validate Vercel configuration', async () => {
      // Given
      const legacyVercelConfig = {
        version: 5,
        projectId: 'test-project',
        teamId: 'test-team',
        rules: mockVercelRemoteConfig.rules,
        ips: mockVercelRemoteConfig.ips,
      }

      await fs.writeFile(vercelConfigPath, JSON.stringify(legacyVercelConfig, null, 2))

      // When
      await validateHandler({
        config: vercelConfigPath,
        verbose: false,
        ci: true,
      } as any)

      // Then - Should pass validation without provider-specific checks
      // (no VercelClient calls expected for basic validation)
    })

    test('should validate Cloudflare configuration', async () => {
      // Given
      const unifiedCloudflareConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'cloudflare',
        providers: {
          cloudflare: {
            zoneId: 'test-zone-id',
          },
        },
        rules: [],
        ips: [],
      }

      await fs.writeFile(cloudflareConfigPath, JSON.stringify(unifiedCloudflareConfig, null, 2))

      // When
      await validateHandler({
        config: cloudflareConfigPath,
        verbose: false,
        ci: true,
      } as any)

      // Then - Should pass validation
      // Basic schema validation should work without provider-specific checks
    })
  })

  describe('Config Format Conversion', () => {
    test('should handle legacy Vercel format', async () => {
      // Given
      const legacyConfig = {
        version: 5,
        projectId: 'test-project',
        teamId: 'test-team',
        rules: [
          {
            id: 'rule_test',
            name: 'Test',
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

      await fs.writeFile(vercelConfigPath, JSON.stringify(legacyConfig, null, 2))

      // When
      await statusHandler({
        config: vercelConfigPath,
        debug: false,
        ci: true,
      } as any)

      // Then - Should work with legacy format
      const { VercelClient } = await import('../lib/services/VercelClient')
      expect(VercelClient.prototype.fetchFirewallConfig).toHaveBeenCalled()
    })

    test('should handle unified format', async () => {
      // Given
      const unifiedConfig: UnifiedConfig = {
        version: '2.0',
        provider: 'vercel',
        providers: {
          vercel: {
            projectId: 'test-project',
            teamId: 'test-team',
          },
        },
        rules: [
          {
            id: 'rule_test',
            name: 'Test',
            description: 'Test',
            conditions: [
              {
                field: 'path',
                operator: 'eq',
                value: '/test',
              },
            ],
            action: {
              type: 'deny',
            },
            enabled: true,
          },
        ],
        ips: [],
      }

      await fs.writeFile(vercelConfigPath, JSON.stringify(unifiedConfig, null, 2))

      // When
      await statusHandler({
        config: vercelConfigPath,
        debug: false,
        ci: true,
      } as any)

      // Then - Should work with unified format
      const { VercelClient } = await import('../lib/services/VercelClient')
      expect(VercelClient.prototype.fetchFirewallConfig).toHaveBeenCalled()
    })
  })
})
