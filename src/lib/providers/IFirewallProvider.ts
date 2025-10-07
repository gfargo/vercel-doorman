/**
 * Core provider interface that all firewall providers must implement
 * Provides a unified API for managing firewall rules across different platforms
 */

/**
 * Provider type discriminator
 */
export type ProviderType = 'vercel' | 'cloudflare'

/**
 * Sync operation options
 */
export interface SyncOptions {
  dryRun?: boolean
  skipBackup?: boolean
  force?: boolean
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  success: boolean
  rulesAdded: number
  rulesUpdated: number
  rulesDeleted: number
  ipsAdded?: number
  ipsUpdated?: number
  ipsDeleted?: number
  version?: number
  errors?: string[]
  warnings?: string[]
}

/**
 * Configuration validation result
 */
export interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
}

export interface ValidationError {
  path: string
  message: string
  code?: string
}

export interface ValidationWarning {
  path: string
  message: string
  code?: string
}

/**
 * Change set representing differences between local and remote configs
 */
export interface ChangeSet {
  rulesToAdd: import('../types/unified').UnifiedRule[]
  rulesToUpdate: import('../types/unified').UnifiedRule[]
  rulesToDelete: import('../types/unified').UnifiedRule[]
  ipsToAdd?: import('../types/unified').UnifiedIPRule[]
  ipsToUpdate?: import('../types/unified').UnifiedIPRule[]
  ipsToDelete?: import('../types/unified').UnifiedIPRule[]
  hasChanges: boolean
}

/**
 * Provider feature capabilities
 */
export interface FeatureSet {
  supportsCustomRules: boolean
  supportsIPBlocking: boolean
  supportsRateLimiting: boolean
  supportsManagedRules: boolean
  supportsGeoBlocking: boolean
  supportsRedirect: boolean
  supportsChallenge: boolean
  maxRules?: number
  maxIPRules?: number
}

/**
 * Configuration health score
 */
export interface HealthScore {
  score: number // 0-100
  grade: 'excellent' | 'good' | 'fair' | 'poor'
  issues: HealthIssue[]
  recommendations: string[]
}

export interface HealthIssue {
  severity: 'error' | 'warning' | 'info'
  category: string
  message: string
  suggestion?: string
}

/**
 * Provider credentials interface
 */
export interface ProviderCredentials {
  [key: string]: string | undefined
}

/**
 * Core firewall provider interface
 * All provider implementations (Vercel, Cloudflare, etc.) must implement this interface
 */
export interface IFirewallProvider {
  /**
   * Provider name identifier
   */
  readonly name: ProviderType

  /**
   * Fetch current configuration from the provider
   * @param version - Optional specific version to fetch
   * @returns Promise resolving to the unified configuration
   */
  fetchConfig(version?: number): Promise<import('../types/unified').UnifiedConfig>

  /**
   * Synchronize local configuration to the provider
   * @param config - Unified configuration to sync
   * @param options - Sync options (dry-run, force, etc.)
   * @returns Promise resolving to sync result with statistics
   */
  syncRules(config: import('../types/unified').UnifiedConfig, options?: SyncOptions): Promise<SyncResult>

  /**
   * Validate configuration against provider constraints
   * @param config - Configuration to validate
   * @returns Validation result with errors and warnings
   */
  validateConfig(config: import('../types/unified').UnifiedConfig): ValidationResult

  /**
   * Calculate differences between local and remote configurations
   * @param config - Local configuration to compare
   * @returns Promise resolving to change set
   */
  getChanges(config: import('../types/unified').UnifiedConfig): Promise<ChangeSet>

  /**
   * Get supported features for this provider
   * @returns Feature set capabilities
   */
  getSupportedFeatures(): FeatureSet

  /**
   * Calculate health score for the given configuration
   * @param config - Configuration to analyze
   * @returns Health score with recommendations
   */
  getHealthScore(config: import('../types/unified').UnifiedConfig): HealthScore

  /**
   * Verify provider credentials and connectivity
   * @returns Promise resolving to true if credentials are valid
   */
  verifyCredentials(): Promise<boolean>
}
