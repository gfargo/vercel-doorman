import type { ProviderType } from '../providers/IFirewallProvider'
import type { VercelRuleType } from '../types/vercel'
import type { ActionType } from '../types/common'

/**
 * Compatibility level for features
 */
export type CompatibilityLevel = 'full' | 'partial' | 'not-supported'

/**
 * Feature compatibility information
 */
export interface FeatureCompatibility {
  level: CompatibilityLevel
  notes?: string
  limitations?: string[]
}

/**
 * Feature Compatibility Matrix
 * Defines what features are supported by each provider
 */
export class CompatibilityMatrix {
  /**
   * Action type compatibility
   */
  private static readonly actionCompatibility: Record<ActionType, Record<ProviderType, FeatureCompatibility>> = {
    log: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full' },
    },
    deny: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'Maps to "block" action' },
    },
    block: {
      vercel: { level: 'not-supported' },
      cloudflare: { level: 'full' },
    },
    challenge: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'Maps to "managed_challenge" for better accuracy' },
    },
    bypass: {
      vercel: { level: 'full' },
      cloudflare: { level: 'partial', notes: 'Maps to "skip" action', limitations: ['Limited skip options'] },
    },
    rate_limit: {
      vercel: { level: 'full' },
      cloudflare: {
        level: 'full',
        notes: 'Uses separate rate limit configuration',
        limitations: ['Different configuration format'],
      },
    },
    redirect: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full' },
    },
    allow: {
      vercel: { level: 'not-supported' },
      cloudflare: { level: 'full' },
    },
  }

  /**
   * Field type compatibility (Vercel → Providers)
   */
  private static readonly fieldCompatibility: Record<VercelRuleType, Record<ProviderType, FeatureCompatibility>> = {
    host: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'http.host' },
    },
    path: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'http.request.uri.path' },
    },
    method: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'http.request.method' },
    },
    header: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'http.request.headers["name"]' },
    },
    query: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'http.request.uri.query' },
    },
    cookie: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'http.cookie' },
    },
    target_path: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'Maps to http.request.uri.path' },
    },
    ip_address: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'ip.src' },
    },
    region: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'ip.geoip.subdivision_1' },
    },
    protocol: {
      vercel: { level: 'full' },
      cloudflare: { level: 'partial', notes: 'Maps to ssl boolean', limitations: ['Only checks HTTPS vs HTTP'] },
    },
    scheme: {
      vercel: { level: 'full' },
      cloudflare: { level: 'partial', notes: 'Maps to ssl boolean', limitations: ['Only checks HTTPS vs HTTP'] },
    },
    environment: {
      vercel: { level: 'full' },
      cloudflare: { level: 'not-supported', notes: 'Vercel-specific feature' },
    },
    user_agent: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'http.user_agent' },
    },
    geo_continent: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'ip.geoip.continent' },
    },
    geo_country: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'ip.geoip.country' },
    },
    geo_country_region: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'ip.geoip.subdivision_1' },
    },
    geo_city: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'ip.geoip.city' },
    },
    geo_as_number: {
      vercel: { level: 'full' },
      cloudflare: { level: 'full', notes: 'ip.geoip.asnum' },
    },
    ja4_digest: {
      vercel: { level: 'full' },
      cloudflare: { level: 'not-supported', notes: 'Vercel-specific feature' },
    },
    ja3_digest: {
      vercel: { level: 'full' },
      cloudflare: { level: 'not-supported', notes: 'Vercel-specific feature' },
    },
    rate_limit_api_id: {
      vercel: { level: 'full' },
      cloudflare: { level: 'not-supported', notes: 'Vercel-specific feature' },
    },
  }

  /**
   * Get action compatibility for a provider
   */
  public static getActionCompatibility(action: ActionType, provider: ProviderType): FeatureCompatibility {
    return (
      this.actionCompatibility[action]?.[provider] || {
        level: 'not-supported',
        notes: 'Unknown action type',
      }
    )
  }

  /**
   * Get field compatibility for a provider
   */
  public static getFieldCompatibility(field: VercelRuleType, provider: ProviderType): FeatureCompatibility {
    return (
      this.fieldCompatibility[field]?.[provider] || {
        level: 'not-supported',
        notes: 'Unknown field type',
      }
    )
  }

  /**
   * Check if an action is supported by a provider
   */
  public static isActionSupported(action: ActionType, provider: ProviderType): boolean {
    const compatibility = this.getActionCompatibility(action, provider)
    return compatibility.level !== 'not-supported'
  }

  /**
   * Check if a field is supported by a provider
   */
  public static isFieldSupported(field: VercelRuleType, provider: ProviderType): boolean {
    const compatibility = this.getFieldCompatibility(field, provider)
    return compatibility.level !== 'not-supported'
  }

  /**
   * Get all unsupported actions for a provider
   */
  public static getUnsupportedActions(provider: ProviderType): ActionType[] {
    return Object.entries(this.actionCompatibility)
      .filter(([_, providers]) => providers[provider].level === 'not-supported')
      .map(([action]) => action as ActionType)
  }

  /**
   * Get all unsupported fields for a provider
   */
  public static getUnsupportedFields(provider: ProviderType): VercelRuleType[] {
    return Object.entries(this.fieldCompatibility)
      .filter(([_, providers]) => providers[provider].level === 'not-supported')
      .map(([field]) => field as VercelRuleType)
  }

  /**
   * Get compatibility report for migrating from one provider to another
   */
  public static getMigrationReport(
    fromProvider: ProviderType,
    toProvider: ProviderType,
  ): {
    fullySupported: string[]
    partiallySupported: string[]
    notSupported: string[]
    warnings: string[]
  } {
    const fullySupported: string[] = []
    const partiallySupported: string[] = []
    const notSupported: string[] = []
    const warnings: string[] = []

    // Check actions
    for (const [action, providers] of Object.entries(this.actionCompatibility)) {
      const fromCompat = providers[fromProvider]
      const toCompat = providers[toProvider]

      if (fromCompat.level !== 'not-supported') {
        if (toCompat.level === 'full') {
          fullySupported.push(`Action: ${action}`)
        } else if (toCompat.level === 'partial') {
          partiallySupported.push(`Action: ${action}`)
          if (toCompat.notes) warnings.push(`${action}: ${toCompat.notes}`)
        } else {
          notSupported.push(`Action: ${action}`)
          warnings.push(`${action} is not supported in ${toProvider}`)
        }
      }
    }

    // Check fields
    for (const [field, providers] of Object.entries(this.fieldCompatibility)) {
      const fromCompat = providers[fromProvider]
      const toCompat = providers[toProvider]

      if (fromCompat.level !== 'not-supported') {
        if (toCompat.level === 'full') {
          fullySupported.push(`Field: ${field}`)
        } else if (toCompat.level === 'partial') {
          partiallySupported.push(`Field: ${field}`)
          if (toCompat.notes) warnings.push(`${field}: ${toCompat.notes}`)
        } else {
          notSupported.push(`Field: ${field}`)
          warnings.push(`${field} is not supported in ${toProvider}`)
        }
      }
    }

    return {
      fullySupported,
      partiallySupported,
      notSupported,
      warnings,
    }
  }
}
