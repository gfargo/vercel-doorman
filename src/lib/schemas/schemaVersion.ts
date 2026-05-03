import { logger } from '../logger'
import type { FirewallConfig } from '../types/vercel'
import type { UnifiedConfig } from '../types/unified'

/**
 * Schema versioning and migration utilities
 */

export const CURRENT_SCHEMA_VERSION = '2.0'
export const LEGACY_SCHEMA_VERSION = '1.0'

/**
 * Detect schema version from configuration
 */
export function detectSchemaVersion(config: unknown): string {
  if (typeof config === 'object' && config !== null) {
    const cfg = config as Record<string, unknown>
    // explicit version
    if (typeof cfg.version === 'string') {
      return cfg.version
    }
    // v2 characteristics
    if ('provider' in cfg || 'providers' in cfg) {
      return '2.0'
    }
    // v1 characteristics
    if ('projectId' in cfg || 'teamId' in cfg) {
      return '1.0'
    }
  }

  // Check for v2 characteristics (multi-provider support)
  if (config.provider || config.providers) {
    return '2.0'
  }

  // Check for v1 Vercel-only characteristics
  if (config.projectId || config.teamId) {
    return '1.0'
  }

  // Default to current version if new config
  return CURRENT_SCHEMA_VERSION
}

/**
 * Check if config needs migration
 */
export function needsMigration(config: unknown): boolean {
  const version = detectSchemaVersion(config)
  return version !== CURRENT_SCHEMA_VERSION
}

/**
 * Migrate v1 Vercel config to v2 unified format
 */
export function migrateV1ToV2(v1Config: FirewallConfig): UnifiedConfig {
  logger.info('Migrating configuration from v1.0 to v2.0 format')

  const migratedConfig: UnifiedConfig = {
    $schema: 'https://doorman.griffen.codes/schema.json',
    version: '2.0',
    provider: 'vercel',
    providers: {
      vercel: {
        projectId: v1Config.projectId,
        teamId: v1Config.teamId,
      },
    },
    rules: v1Config.rules.map((rule) => ({
      id: rule.id,
      name: rule.name,
      description: rule.description,
      enabled: rule.active,
      conditions: convertV1ConditionsToUnified(rule),
      conditionLogic: 'OR', // Vercel uses OR between condition groups
      action: {
        type: rule.action.mitigate.action,
        rateLimit: rule.action.mitigate.rateLimit
          ? {
              requests: rule.action.mitigate.rateLimit.requests,
              window: rule.action.mitigate.rateLimit.window,
            }
          : undefined,
        redirect: rule.action.mitigate.redirect
          ? {
              location: rule.action.mitigate.redirect.location,
              permanent: rule.action.mitigate.redirect.permanent,
            }
          : undefined,
        duration: rule.action.mitigate.actionDuration || undefined,
      },
    })),
    ips: v1Config.ips?.map((ip) => ({
      id: ip.id,
      ip: ip.ip,
      hostname: ip.hostname,
      notes: ip.notes,
      action: ip.action,
    })),
    metadata: {
      version: v1Config.version,
      updatedAt: v1Config.updatedAt,
      migratedFrom: '1.0',
      migratedAt: new Date().toISOString(),
    },
  }

  return migratedConfig
}

/**
 * Convert v1 Vercel condition groups to unified conditions
 * In v1, condition groups are OR'd together, conditions within a group are AND'd
 * This needs to be flattened for unified format
 */
import type { UnifiedCondition } from '../types/unified'
import type { VercelCustomRule } from '../types/vercel'

function convertV1ConditionsToUnified(rule: VercelCustomRule): UnifiedCondition[] {
  const conditions: UnifiedCondition[] = []

  // Flatten condition groups
  for (const group of rule.conditionGroup || []) {
    for (const condition of group.conditions || []) {
      conditions.push({
        field: mapVercelTypeToField(condition.type),
        operator: mapVercelOperatorToUnified(condition.op),
        value: condition.value as string | number | string[] | number[],
        negated: condition.neg,
        key: condition.key,
      })
    }
  }

  return conditions
}

/**
 * Map Vercel rule types to unified field types
 */
function mapVercelTypeToField(type: string): string {
  const mapping: Record<string, string> = {
    host: 'host',
    path: 'path',
    method: 'method',
    header: 'header',
    query: 'query',
    cookie: 'cookie',
    ip_address: 'ip',
    user_agent: 'user_agent',
    geo_country: 'country',
    geo_city: 'city',
    geo_as_number: 'asn',
    scheme: 'scheme',
    // Add more mappings as needed
  }

  return mapping[type] || type
}

/**
 * Map Vercel operators to unified operators
 */
function mapVercelOperatorToUnified(op: string): string {
  const mapping: Record<string, string> = {
    eq: 'eq',
    pre: 'starts_with',
    suf: 'ends_with',
    inc: 'in',
    sub: 'contains',
    re: 'matches',
    ex: 'exists',
    nex: 'not_exists',
  }

  return mapping[op] || op
}

/**
 * Auto-migrate config if needed
 */
export function autoMigrate(config: unknown): UnifiedConfig {
  const version = detectSchemaVersion(config)

  if (version === '1.0') {
    logger.info('Detected v1.0 configuration, auto-migrating to v2.0')
    return migrateV1ToV2(config as FirewallConfig)
  }

  if (version === '2.0') {
    return config as UnifiedConfig
  }

  throw new Error(`Unsupported schema version: ${version}`)
}

/**
 * Validate schema version compatibility
 */
export function isCompatibleVersion(version: string): boolean {
  return version === '1.0' || version === '2.0'
}
