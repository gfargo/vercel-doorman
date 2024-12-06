/**
 * Core Types
 */
export type ActionType = 'log' | 'deny' | 'challenge' | 'bypass' | 'rate_limit' | 'redirect'

export type RuleOperator =
  | 're' // Regular expression
  | 'eq' // Equals
  | 'neq' // Not equals
  | 'ex' // Exists
  | 'nex' // Not exists
  | 'inc' // Includes
  | 'ninc' // Not includes
  | 'pre' // Prefix
  | 'suf' // Suffix
  | 'sub' // Substring
  | 'gt' // Greater than
  | 'gte' // Greater than or equal
  | 'lt' // Less than
  | 'lte' // Less than or equal

export type RuleType =
  | 'host'
  | 'path'
  | 'method'
  | 'header'
  | 'query'
  | 'cookie'
  | 'target_path'
  | 'ip_address'
  | 'region'
  | 'protocol'
  | 'scheme'
  | 'environment'
  | 'user_agent'
  | 'geo_continent'
  | 'geo_country'
  | 'geo_country_region'
  | 'geo_city'
  | 'geo_as_number'
  | 'ja4_digest'
  | 'ja3_digest'
  | 'rate_limit_api_id'

/**
 * Rule Condition Types
 */
export interface RuleCondition {
  op: RuleOperator
  type: RuleType
  key?: string
  value?: string | number | string[] | number[]
}

export interface ConditionGroup {
  conditions: RuleCondition[]
}

/**
 * Action Types
 */
export interface RateLimit {
  requests: number
  window: string // e.g., "60s", "1h", "1d"
}

export interface Redirect {
  location: string
  permanent?: boolean
}

export interface MitigationAction {
  action: ActionType
  rateLimit?: RateLimit | null
  redirect?: Redirect | null
  actionDuration?: string | null // e.g., "1h", "1d", "permanent"
}

export interface RuleAction {
  mitigate: MitigationAction
}

/**
 * Rule Types
 */
export interface CustomRule {
  id?: string
  name: string
  description?: string
  conditionGroup: ConditionGroup[]
  action: RuleAction
  active: boolean
}

export interface IPBlockingRule {
  id?: string
  ip: string
  hostname: string
  notes?: string
  action: 'deny' // Currently only 'deny' is supported for IP blocking
}

/**
 * Configuration Types
 */
export interface ProjectConfig {
  projectId?: string
  teamId?: string
}

export interface FirewallConfig extends ProjectConfig {
  version?: number
  rules: CustomRule[]
  ips?: IPBlockingRule[]
  updatedAt?: string
}
