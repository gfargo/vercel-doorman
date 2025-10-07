/**
 * Provider abstraction layer exports
 * Provides unified interface for managing firewall rules across multiple providers
 */

// Core interfaces and types
export type {
  IFirewallProvider,
  ProviderType,
  SyncOptions,
  SyncResult,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  ChangeSet,
  FeatureSet,
  HealthScore,
  HealthIssue,
  ProviderCredentials,
} from './IFirewallProvider'

// Base classes
export { BaseFirewallClient } from './BaseFirewallClient'
export type { RequestOptions, RateLimitInfo } from './BaseFirewallClient'

export { BaseFirewallService } from './BaseFirewallService'
export type { CompareFn, DiffResult } from './BaseFirewallService'

// Provider management
export { ProviderRegistry, getProviderRegistry } from './ProviderRegistry'
export type { ProviderFactory } from './ProviderRegistry'

export { ProviderDetector } from './ProviderDetector'
export type { DetectionResult } from './ProviderDetector'
