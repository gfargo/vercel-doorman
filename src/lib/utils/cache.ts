import { logger } from '../logger'

/**
 * Cache entry with TTL and metadata
 */
interface CacheEntry<T> {
  value: T
  expiresAt: number
  createdAt: number
  hits: number
}

/**
 * Cache statistics for monitoring
 */
export interface CacheStats {
  hits: number
  misses: number
  size: number
  evictions: number
  hitRate: number
}

/**
 * Cache configuration options
 */
export interface CacheOptions {
  /** Default TTL in milliseconds (default: 5 minutes) */
  defaultTTL: number
  /** Maximum number of entries (default: 100) */
  maxEntries: number
  /** Whether to log cache operations at debug level (default: true) */
  enableLogging: boolean
}

const DEFAULT_CACHE_OPTIONS: CacheOptions = {
  defaultTTL: 5 * 60 * 1000, // 5 minutes
  maxEntries: 100,
  enableLogging: true,
}

/**
 * In-memory cache with TTL support, LRU eviction, and hit/miss metrics.
 *
 * Used to avoid redundant API calls for data that doesn't change frequently,
 * such as zone info, credential validation results, and ruleset listings.
 */
export class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private options: CacheOptions
  private stats = { hits: 0, misses: 0, evictions: 0 }

  constructor(options: Partial<CacheOptions> = {}) {
    this.options = { ...DEFAULT_CACHE_OPTIONS, ...options }
  }

  /**
   * Get a cached value by key. Returns undefined on miss or expiry.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      if (this.options.enableLogging) {
        logger.debug(`Cache miss: ${key}`)
      }
      return undefined
    }

    // Check expiry
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      this.stats.misses++
      if (this.options.enableLogging) {
        logger.debug(`Cache expired: ${key}`)
      }
      return undefined
    }

    entry.hits++
    this.stats.hits++
    if (this.options.enableLogging) {
      logger.debug(`Cache hit: ${key} (${entry.hits} total hits)`)
    }
    return entry.value as T
  }

  /**
   * Store a value in the cache with an optional TTL override.
   */
  set<T>(key: string, value: T, ttl?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.options.maxEntries && !this.cache.has(key)) {
      this.evictLeastRecentlyUsed()
    }

    const effectiveTTL = ttl ?? this.options.defaultTTL
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + effectiveTTL,
      createdAt: Date.now(),
      hits: 0,
    })

    if (this.options.enableLogging) {
      logger.debug(`Cache set: ${key} (TTL: ${effectiveTTL}ms)`)
    }
  }

  /**
   * Invalidate a specific cache entry.
   */
  invalidate(key: string): boolean {
    const deleted = this.cache.delete(key)
    if (deleted && this.options.enableLogging) {
      logger.debug(`Cache invalidated: ${key}`)
    }
    return deleted
  }

  /**
   * Invalidate all entries whose keys match a prefix.
   * Useful for clearing all entries related to a specific zone or account.
   */
  invalidateByPrefix(prefix: string): number {
    let count = 0
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key)
        count++
      }
    }
    if (count > 0 && this.options.enableLogging) {
      logger.debug(`Cache invalidated ${count} entries with prefix: ${prefix}`)
    }
    return count
  }

  /**
   * Clear the entire cache.
   */
  clear(): void {
    const size = this.cache.size
    this.cache.clear()
    if (this.options.enableLogging) {
      logger.debug(`Cache cleared (${size} entries removed)`)
    }
  }

  /**
   * Get cache statistics for monitoring.
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.cache.size,
      evictions: this.stats.evictions,
      hitRate: total > 0 ? this.stats.hits / total : 0,
    }
  }

  /**
   * Reset statistics counters.
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 }
  }

  /**
   * Check whether a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.cache.get(key)
    if (!entry) return false
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return false
    }
    return true
  }

  /**
   * Evict the least-recently-used entry (fewest hits, oldest creation).
   */
  private evictLeastRecentlyUsed(): void {
    let lruKey: string | undefined
    let lruEntry: CacheEntry<unknown> | undefined

    for (const [key, entry] of this.cache.entries()) {
      // Evict expired entries first
      if (Date.now() > entry.expiresAt) {
        this.cache.delete(key)
        this.stats.evictions++
        return
      }

      if (
        !lruEntry ||
        entry.hits < lruEntry.hits ||
        (entry.hits === lruEntry.hits && entry.createdAt < lruEntry.createdAt)
      ) {
        lruKey = key
        lruEntry = entry
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey)
      this.stats.evictions++
      if (this.options.enableLogging) {
        logger.debug(`Cache evicted LRU entry: ${lruKey}`)
      }
    }
  }
}

/**
 * Pre-defined cache key builders for Cloudflare operations.
 * Keeps key generation consistent across the codebase.
 */
export const CacheKeys = {
  zoneInfo: (zoneId: string) => `zone:${zoneId}:info`,
  rulesets: (zoneId: string) => `zone:${zoneId}:rulesets`,
  ruleset: (zoneId: string, rulesetId: string) => `zone:${zoneId}:ruleset:${rulesetId}`,
  lists: (accountId: string) => `account:${accountId}:lists`,
  listItems: (accountId: string, listId: string) => `account:${accountId}:list:${listId}:items`,
  credentialValidation: (tokenHash: string) => `cred:${tokenHash}`,
  configValidation: (configHash: string) => `config:${configHash}`,
}

/**
 * Pre-defined TTL values in milliseconds.
 */
export const CacheTTL = {
  /** Zone info rarely changes – cache for 10 minutes */
  ZONE_INFO: 10 * 60 * 1000,
  /** Ruleset list – cache for 2 minutes */
  RULESETS: 2 * 60 * 1000,
  /** Individual ruleset – cache for 1 minute (rules change more often) */
  RULESET: 1 * 60 * 1000,
  /** Lists – cache for 5 minutes */
  LISTS: 5 * 60 * 1000,
  /** List items – cache for 2 minutes */
  LIST_ITEMS: 2 * 60 * 1000,
  /** Credential validation – cache for 15 minutes */
  CREDENTIALS: 15 * 60 * 1000,
  /** Config validation – cache for 5 minutes */
  CONFIG_VALIDATION: 5 * 60 * 1000,
}
