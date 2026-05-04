import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { ApiCache, CacheKeys, CacheTTL } from '../cache'

describe('ApiCache', () => {
  let cache: ApiCache

  beforeEach(() => {
    cache = new ApiCache({ enableLogging: false })
  })

  describe('basic get/set', () => {
    it('should return undefined for missing keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined()
    })

    it('should store and retrieve values', () => {
      cache.set('key1', { name: 'test' })
      expect(cache.get('key1')).toEqual({ name: 'test' })
    })

    it('should overwrite existing values', () => {
      cache.set('key1', 'first')
      cache.set('key1', 'second')
      expect(cache.get('key1')).toBe('second')
    })

    it('should store different types', () => {
      cache.set('string', 'hello')
      cache.set('number', 42)
      cache.set('array', [1, 2, 3])
      cache.set('object', { a: 1 })
      cache.set('boolean', true)

      expect(cache.get('string')).toBe('hello')
      expect(cache.get('number')).toBe(42)
      expect(cache.get('array')).toEqual([1, 2, 3])
      expect(cache.get('object')).toEqual({ a: 1 })
      expect(cache.get('boolean')).toBe(true)
    })
  })

  describe('TTL expiration', () => {
    it('should expire entries after TTL', () => {
      const shortCache = new ApiCache({ defaultTTL: 50, enableLogging: false })
      shortCache.set('key', 'value')

      expect(shortCache.get('key')).toBe('value')

      // Advance time past TTL
      jest.useFakeTimers()
      jest.advanceTimersByTime(100)

      expect(shortCache.get('key')).toBeUndefined()
      jest.useRealTimers()
    })

    it('should respect per-entry TTL override', () => {
      jest.useFakeTimers()

      cache.set('short', 'value', 100)
      cache.set('long', 'value', 10000)

      jest.advanceTimersByTime(200)

      expect(cache.get('short')).toBeUndefined()
      expect(cache.get('long')).toBe('value')

      jest.useRealTimers()
    })

    it('should report expired entries via has()', () => {
      jest.useFakeTimers()

      cache.set('key', 'value', 50)
      expect(cache.has('key')).toBe(true)

      jest.advanceTimersByTime(100)
      expect(cache.has('key')).toBe(false)

      jest.useRealTimers()
    })
  })

  describe('invalidation', () => {
    it('should invalidate a specific key', () => {
      cache.set('key1', 'value1')
      cache.set('key2', 'value2')

      expect(cache.invalidate('key1')).toBe(true)
      expect(cache.get('key1')).toBeUndefined()
      expect(cache.get('key2')).toBe('value2')
    })

    it('should return false when invalidating a missing key', () => {
      expect(cache.invalidate('nonexistent')).toBe(false)
    })

    it('should invalidate by prefix', () => {
      cache.set('zone:abc:rulesets', [1])
      cache.set('zone:abc:ruleset:r1', { id: 'r1' })
      cache.set('zone:def:rulesets', [2])
      cache.set('account:123:lists', [3])

      const count = cache.invalidateByPrefix('zone:abc')
      expect(count).toBe(2)
      expect(cache.get('zone:abc:rulesets')).toBeUndefined()
      expect(cache.get('zone:abc:ruleset:r1')).toBeUndefined()
      expect(cache.get('zone:def:rulesets')).toEqual([2])
      expect(cache.get('account:123:lists')).toEqual([3])
    })

    it('should clear all entries', () => {
      cache.set('a', 1)
      cache.set('b', 2)
      cache.set('c', 3)

      cache.clear()

      expect(cache.get('a')).toBeUndefined()
      expect(cache.get('b')).toBeUndefined()
      expect(cache.get('c')).toBeUndefined()
    })
  })

  describe('LRU eviction', () => {
    it('should evict least-used entry when at capacity', () => {
      const smallCache = new ApiCache({ maxEntries: 3, enableLogging: false })

      smallCache.set('a', 1)
      smallCache.set('b', 2)
      smallCache.set('c', 3)

      // Access 'a' and 'c' to increase their hit counts
      smallCache.get('a')
      smallCache.get('c')

      // Adding a 4th entry should evict 'b' (fewest hits)
      smallCache.set('d', 4)

      expect(smallCache.get('a')).toBe(1)
      expect(smallCache.get('b')).toBeUndefined()
      expect(smallCache.get('c')).toBe(3)
      expect(smallCache.get('d')).toBe(4)
    })

    it('should evict expired entries first', () => {
      jest.useFakeTimers()

      const smallCache = new ApiCache({ maxEntries: 3, enableLogging: false })

      smallCache.set('a', 1, 50)
      smallCache.set('b', 2, 50000)
      smallCache.set('c', 3, 50000)

      // Expire 'a'
      jest.advanceTimersByTime(100)

      // Adding a 4th entry should evict expired 'a' first
      smallCache.set('d', 4)

      expect(smallCache.get('b')).toBe(2)
      expect(smallCache.get('c')).toBe(3)
      expect(smallCache.get('d')).toBe(4)

      jest.useRealTimers()
    })
  })

  describe('statistics', () => {
    it('should track hits and misses', () => {
      cache.set('key', 'value')

      cache.get('key') // hit
      cache.get('key') // hit
      cache.get('missing') // miss

      const stats = cache.getStats()
      expect(stats.hits).toBe(2)
      expect(stats.misses).toBe(1)
      expect(stats.hitRate).toBeCloseTo(2 / 3)
    })

    it('should track cache size', () => {
      cache.set('a', 1)
      cache.set('b', 2)

      expect(cache.getStats().size).toBe(2)

      cache.invalidate('a')
      expect(cache.getStats().size).toBe(1)
    })

    it('should track evictions', () => {
      const smallCache = new ApiCache({ maxEntries: 2, enableLogging: false })

      smallCache.set('a', 1)
      smallCache.set('b', 2)
      smallCache.set('c', 3) // triggers eviction

      expect(smallCache.getStats().evictions).toBe(1)
    })

    it('should report 0 hit rate when empty', () => {
      expect(cache.getStats().hitRate).toBe(0)
    })

    it('should reset statistics', () => {
      cache.set('key', 'value')
      cache.get('key')
      cache.get('missing')

      cache.resetStats()

      const stats = cache.getStats()
      expect(stats.hits).toBe(0)
      expect(stats.misses).toBe(0)
      expect(stats.evictions).toBe(0)
    })
  })
})

describe('CacheKeys', () => {
  it('should generate consistent zone-scoped keys', () => {
    expect(CacheKeys.zoneInfo('z1')).toBe('zone:z1:info')
    expect(CacheKeys.rulesets('z1')).toBe('zone:z1:rulesets')
    expect(CacheKeys.ruleset('z1', 'rs1')).toBe('zone:z1:ruleset:rs1')
  })

  it('should generate consistent account-scoped keys', () => {
    expect(CacheKeys.lists('a1')).toBe('account:a1:lists')
    expect(CacheKeys.listItems('a1', 'l1')).toBe('account:a1:list:l1:items')
  })

  it('should generate credential and config validation keys', () => {
    expect(CacheKeys.credentialValidation('abc123')).toBe('cred:abc123')
    expect(CacheKeys.configValidation('hash456')).toBe('config:hash456')
  })
})

describe('CacheTTL', () => {
  it('should have reasonable TTL values', () => {
    expect(CacheTTL.ZONE_INFO).toBeGreaterThan(CacheTTL.RULESETS)
    expect(CacheTTL.RULESETS).toBeGreaterThanOrEqual(CacheTTL.RULESET)
    expect(CacheTTL.CREDENTIALS).toBeGreaterThan(CacheTTL.ZONE_INFO)
  })
})
