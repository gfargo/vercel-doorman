jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { ProviderRegistry, getProviderRegistry } from '../ProviderRegistry'
import type { IFirewallProvider } from '../IFirewallProvider'

// Minimal mock provider
function createMockProvider(name: 'vercel' | 'cloudflare'): IFirewallProvider {
  return {
    name,
    fetchConfig: jest.fn(),
    syncRules: jest.fn(),
    validateConfig: jest.fn(),
    getChanges: jest.fn(),
    getSupportedFeatures: jest.fn(),
    getHealthScore: jest.fn(),
    verifyCredentials: jest.fn(),
  } as unknown as IFirewallProvider
}

describe('ProviderRegistry', () => {
  let registry: ProviderRegistry

  beforeEach(() => {
    registry = ProviderRegistry.getInstance()
    registry.clear()
  })

  describe('singleton', () => {
    it('returns the same instance', () => {
      const a = ProviderRegistry.getInstance()
      const b = ProviderRegistry.getInstance()
      expect(a).toBe(b)
    })
  })

  describe('register and get', () => {
    it('registers a factory and creates provider on get', async () => {
      const mockProvider = createMockProvider('vercel')
      registry.register('vercel', () => mockProvider)

      const provider = await registry.get('vercel')
      expect(provider).toBe(mockProvider)
    })

    it('caches provider instance after first get', async () => {
      let callCount = 0
      const mockProvider = createMockProvider('vercel')
      registry.register('vercel', () => {
        callCount++
        return mockProvider
      })

      await registry.get('vercel')
      await registry.get('vercel')
      expect(callCount).toBe(1)
    })

    it('supports async factory functions', async () => {
      const mockProvider = createMockProvider('cloudflare')
      registry.register('cloudflare', async () => mockProvider)

      const provider = await registry.get('cloudflare')
      expect(provider).toBe(mockProvider)
    })

    it('throws when getting unregistered provider', async () => {
      await expect(registry.get('cloudflare')).rejects.toThrow(/not registered/)
    })

    it('includes available providers in error message', async () => {
      registry.register('vercel', () => createMockProvider('vercel'))
      await expect(registry.get('cloudflare')).rejects.toThrow(/vercel/)
    })
  })

  describe('registerInstance', () => {
    it('registers a provider instance directly', async () => {
      const mockProvider = createMockProvider('vercel')
      registry.registerInstance('vercel', mockProvider)

      const provider = await registry.get('vercel')
      expect(provider).toBe(mockProvider)
    })
  })

  describe('getSync', () => {
    it('returns undefined for non-instantiated provider', () => {
      registry.register('vercel', () => createMockProvider('vercel'))
      expect(registry.getSync('vercel')).toBeUndefined()
    })

    it('returns provider after it has been instantiated', async () => {
      const mockProvider = createMockProvider('vercel')
      registry.register('vercel', () => mockProvider)
      await registry.get('vercel')

      expect(registry.getSync('vercel')).toBe(mockProvider)
    })
  })

  describe('has', () => {
    it('returns true for registered factory', () => {
      registry.register('vercel', () => createMockProvider('vercel'))
      expect(registry.has('vercel')).toBe(true)
    })

    it('returns true for registered instance', () => {
      registry.registerInstance('cloudflare', createMockProvider('cloudflare'))
      expect(registry.has('cloudflare')).toBe(true)
    })

    it('returns false for unregistered provider', () => {
      expect(registry.has('cloudflare')).toBe(false)
    })
  })

  describe('getAvailableProviders', () => {
    it('returns empty array when nothing registered', () => {
      expect(registry.getAvailableProviders()).toEqual([])
    })

    it('returns all registered providers', () => {
      registry.register('vercel', () => createMockProvider('vercel'))
      registry.register('cloudflare', () => createMockProvider('cloudflare'))
      const providers = registry.getAvailableProviders()
      expect(providers).toContain('vercel')
      expect(providers).toContain('cloudflare')
    })

    it('deduplicates factory and instance registrations', async () => {
      const mockProvider = createMockProvider('vercel')
      registry.register('vercel', () => mockProvider)
      await registry.get('vercel') // This also stores in providers map
      const providers = registry.getAvailableProviders()
      const vercelCount = providers.filter((p) => p === 'vercel').length
      expect(vercelCount).toBe(1)
    })
  })

  describe('clear', () => {
    it('removes all registered providers and factories', () => {
      registry.register('vercel', () => createMockProvider('vercel'))
      registry.registerInstance('cloudflare', createMockProvider('cloudflare'))
      registry.clear()
      expect(registry.has('vercel')).toBe(false)
      expect(registry.has('cloudflare')).toBe(false)
      expect(registry.getAvailableProviders()).toEqual([])
    })
  })

  describe('unregister', () => {
    it('removes a specific provider', async () => {
      registry.register('vercel', () => createMockProvider('vercel'))
      registry.register('cloudflare', () => createMockProvider('cloudflare'))
      registry.unregister('vercel')
      expect(registry.has('vercel')).toBe(false)
      expect(registry.has('cloudflare')).toBe(true)
    })
  })

  describe('getProviderRegistry convenience function', () => {
    it('returns the singleton instance', () => {
      const r = getProviderRegistry()
      expect(r).toBe(ProviderRegistry.getInstance())
    })
  })
})
