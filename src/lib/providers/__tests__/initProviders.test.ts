jest.mock('../../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}))

import { ProviderRegistry } from '../ProviderRegistry'
import { initProviders } from '../initProviders'

describe('initProviders', () => {
  let registry: ProviderRegistry

  beforeEach(() => {
    registry = ProviderRegistry.getInstance()
    registry.clear()
  })

  it('registers vercel provider factory', () => {
    initProviders()
    expect(registry.has('vercel')).toBe(true)
  })

  it('registers cloudflare provider factory', () => {
    initProviders()
    expect(registry.has('cloudflare')).toBe(true)
  })

  it('registers both providers', () => {
    initProviders()
    const providers = registry.getAvailableProviders()
    expect(providers).toContain('vercel')
    expect(providers).toContain('cloudflare')
  })

  it('can be called multiple times without error', () => {
    expect(() => {
      initProviders()
      initProviders()
    }).not.toThrow()
  })
})
