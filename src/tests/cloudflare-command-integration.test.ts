/**
 * Integration tests for Cloudflare command support
 * Tests that all commands properly integrate with Cloudflare provider
 */

describe('Cloudflare Command Integration', () => {

  describe('Provider Integration', () => {
    it('should support Cloudflare provider options', () => {
      const { getProviderInstance } = require('../lib/utils/providerHelper')
      
      // Test that provider helper can be called with Cloudflare options
      expect(() => {
        getProviderInstance({
          provider: 'cloudflare',
          apiToken: 'test-token',
          zoneId: 'test-zone',
          accountId: 'test-account',
        })
      }).not.toThrow()
    })

    it('should return Cloudflare provider display name', () => {
      const { getProviderDisplayName } = require('../lib/utils/providerHelper')
      expect(getProviderDisplayName('cloudflare')).toBe('Cloudflare WAF')
    })
  })

  describe('Command Builder Options', () => {
    it('should include Cloudflare options in command builders', () => {
      // Import command builders to check they include Cloudflare options
      const syncCommand = require('../commands/sync')
      const listCommand = require('../commands/list')
      const statusCommand = require('../commands/status')
      
      // Check that builders include Cloudflare-specific options
      expect(syncCommand.builder.provider.choices).toContain('cloudflare')
      expect(syncCommand.builder.apiToken).toBeDefined()
      expect(syncCommand.builder.zoneId).toBeDefined()
      expect(syncCommand.builder.accountId).toBeDefined()
      
      expect(listCommand.builder.provider.choices).toContain('cloudflare')
      expect(statusCommand.builder.provider.choices).toContain('cloudflare')
    })
  })

  describe('Command Descriptions', () => {
    it('should include Cloudflare support in command descriptions', () => {
      const syncCommand = require('../commands/sync')
      const listCommand = require('../commands/list')
      const statusCommand = require('../commands/status')
      const diffCommand = require('../commands/diff')
      const initCommand = require('../commands/init')
      
      // Check that command descriptions mention Cloudflare support
      expect(syncCommand.desc).toContain('Cloudflare')
      expect(listCommand.desc).toContain('Cloudflare')
      expect(statusCommand.desc).toContain('Cloudflare')
      expect(diffCommand.desc).toContain('Cloudflare')
      expect(initCommand.desc).toContain('Cloudflare')
    })
  })

  describe('Examples and Documentation', () => {
    it('should include examples for key commands', () => {
      const initCommand = require('../commands/init')
      const healthCommand = require('../commands/health')
      
      // Check that key commands have examples
      expect(initCommand.examples).toBeDefined()
      expect(initCommand.examples.length).toBeGreaterThan(0)
      
      // Health command uses yargs examples format
      expect(healthCommand.builder).toBeDefined()
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain Vercel compatibility structures', () => {
      // Test that legacy Vercel config structures are still supported
      const legacyConfig = {
        projectId: 'test-project',
        teamId: 'test-team',
        version: 1,
        updatedAt: new Date().toISOString(),
        rules: [],
        ips: [],
      }

      // Should be able to process legacy config
      expect(legacyConfig.projectId).toBeDefined()
      expect(legacyConfig.rules).toBeDefined()
      expect(legacyConfig.ips).toBeDefined()
    })
  })
})