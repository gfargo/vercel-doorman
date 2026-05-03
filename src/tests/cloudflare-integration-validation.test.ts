/**
 * Comprehensive integration validation for Cloudflare support
 * Tests that all commands work properly with Cloudflare provider
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals'
import { execSync } from 'child_process'
import { existsSync, readFileSync, unlinkSync } from 'fs'
import { join } from 'path'

// Skip these tests if Cloudflare credentials are not available
const hasCloudflareCredentials = process.env.CLOUDFLARE_API_TOKEN && process.env.CLOUDFLARE_ZONE_ID
const describeIf = hasCloudflareCredentials ? describe : describe.skip

describeIf('Cloudflare Integration Validation', () => {
  const testConfigPath = join(process.cwd(), 'test-cloudflare-config.json')
  const testBackupPath = join(process.cwd(), 'test-cloudflare-backup.json')

  beforeAll(() => {
    // Ensure we have a clean test environment
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath)
    }
    if (existsSync(testBackupPath)) {
      unlinkSync(testBackupPath)
    }
  })

  afterAll(() => {
    // Clean up test files
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath)
    }
    if (existsSync(testBackupPath)) {
      unlinkSync(testBackupPath)
    }
  })

  describe('Command Integration', () => {
    it('should support health command with Cloudflare provider', () => {
      const result = execSync('npm run cli health --provider cloudflare --quick', {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).toContain('Cloudflare')
      expect(result).not.toContain('Error')
    })

    it('should support validate command with Cloudflare provider', () => {
      // Create a minimal test config
      const testConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [],
        metadata: {
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      }

      require('fs').writeFileSync(testConfigPath, JSON.stringify(testConfig, null, 2))

      const result = execSync(`npm run cli validate --config ${testConfigPath} --provider cloudflare`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).toContain('valid')
      expect(result).not.toContain('Error')
    })

    it('should support list command with Cloudflare provider', () => {
      const result = execSync('npm run cli list --provider cloudflare --format json', {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      // Should return valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
      
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('provider', 'cloudflare')
      expect(parsed).toHaveProperty('rules')
      expect(parsed).toHaveProperty('ips')
    })

    it('should support status command with Cloudflare provider', () => {
      const result = execSync(`npm run cli status --config ${testConfigPath} --provider cloudflare`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).toContain('Cloudflare')
      expect(result).toContain('sync status')
      expect(result).not.toContain('Error')
    })

    it('should support diff command with Cloudflare provider', () => {
      const result = execSync(`npm run cli diff --config ${testConfigPath} --provider cloudflare`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).toContain('Cloudflare')
      expect(result).not.toContain('Error')
    })

    it('should support backup command with Cloudflare provider', () => {
      const result = execSync(`npm run cli backup --provider cloudflare --output ${testBackupPath}`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).toContain('Backup created')
      expect(existsSync(testBackupPath)).toBe(true)
      
      // Validate backup content
      const backupContent = JSON.parse(readFileSync(testBackupPath, 'utf8'))
      expect(backupContent).toHaveProperty('backup')
      expect(backupContent.backup).toHaveProperty('provider', 'cloudflare')
    })

    it('should support export command with Cloudflare provider', () => {
      const result = execSync('npm run cli export --provider cloudflare --source remote --format json', {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      // Should return valid JSON
      expect(() => JSON.parse(result)).not.toThrow()
      
      const parsed = JSON.parse(result)
      expect(parsed).toHaveProperty('rules')
      expect(parsed).toHaveProperty('ips')
    })

    it('should support template command with Cloudflare provider (dry-run)', () => {
      const result = execSync(`npm run cli template ai-bots --config ${testConfigPath} --provider cloudflare --dry-run`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).toContain('Dry run')
      expect(result).toContain('Cloudflare')
      expect(result).not.toContain('Error')
    })
  })

  describe('Provider-Specific Features', () => {
    it('should handle Cloudflare-specific options', () => {
      const result = execSync('npm run cli list --provider cloudflare --api-token $CLOUDFLARE_API_TOKEN --zone-id $CLOUDFLARE_ZONE_ID', {
        encoding: 'utf8',
        timeout: 30000,
        env: { ...process.env },
      })
      
      expect(result).not.toContain('Error')
      expect(result).not.toContain('Invalid')
    })

    it('should auto-detect Cloudflare provider from config', () => {
      const cloudflareConfig = {
        version: '2.0',
        provider: 'cloudflare',
        rules: [],
        ips: [],
        metadata: {
          version: 1,
          updatedAt: new Date().toISOString(),
        },
      }

      require('fs').writeFileSync(testConfigPath, JSON.stringify(cloudflareConfig, null, 2))

      const result = execSync(`npm run cli validate --config ${testConfigPath}`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).toContain('Cloudflare')
      expect(result).not.toContain('Error')
    })
  })

  describe('Error Handling', () => {
    it('should handle invalid Cloudflare credentials gracefully', () => {
      expect(() => {
        execSync('npm run cli list --provider cloudflare --api-token invalid --zone-id invalid', {
          encoding: 'utf8',
          timeout: 30000,
          stdio: 'pipe',
        })
      }).toThrow()
    })

    it('should provide helpful error messages for missing credentials', () => {
      try {
        execSync('npm run cli list --provider cloudflare', {
          encoding: 'utf8',
          timeout: 30000,
          stdio: 'pipe',
          env: { ...process.env, CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_ZONE_ID: '' },
        })
      } catch (error: any) {
        expect(error.stdout || error.stderr).toContain('token')
      }
    })
  })

  describe('Performance', () => {
    it('should complete basic operations within reasonable time', () => {
      const startTime = Date.now()
      
      execSync('npm run cli health --provider cloudflare --quick', {
        encoding: 'utf8',
        timeout: 10000, // 10 second timeout
      })
      
      const duration = Date.now() - startTime
      expect(duration).toBeLessThan(10000) // Should complete within 10 seconds
    })
  })

  describe('Backward Compatibility', () => {
    it('should maintain Vercel compatibility when no provider specified', () => {
      const legacyConfig = {
        projectId: 'test-project',
        teamId: 'test-team',
        version: 1,
        updatedAt: new Date().toISOString(),
        rules: [],
        ips: [],
      }

      require('fs').writeFileSync(testConfigPath, JSON.stringify(legacyConfig, null, 2))

      // Should not throw error and should handle legacy format
      const result = execSync(`npm run cli validate --config ${testConfigPath}`, {
        encoding: 'utf8',
        timeout: 30000,
      })
      
      expect(result).not.toContain('Error')
    })
  })
})