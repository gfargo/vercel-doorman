export type RuleOperator =
  | 're'
  | 'eq'
  | 'neq'
  | 'ex'
  | 'nex'
  | 'inc'
  | 'ninc'
  | 'pre'
  | 'suf'
  | 'sub'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'

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

export interface VercelCondition {
  op: RuleOperator
  type: RuleType
  value: string | number | string[] | number[]
}

export interface VercelConditionGroup {
  conditions: VercelCondition[]
}

export interface RateLimit {
  requests: number
  window: string // e.g., "60s", "1h", "1d"
}

export interface Redirect {
  location: string
  pemanent?: boolean
}

export interface MitigationAction {
  action: 'log' | 'deny' | 'challenge' | 'bypass' | 'rate_limit' | 'redirect'
  rateLimit?: RateLimit | null
  redirect?: Redirect | null
  actionDuration?: string | null // e.g., "1h", "1d", "permanent"
}

export interface VercelAction {
  mitigate: MitigationAction
}

export interface VercelRule {
  id?: string | null
  active: boolean
  name: string
  description?: string
  conditionGroup: VercelConditionGroup[]
  action: VercelAction
}

export interface VercelIPBlockingRule {
  action: 'deny'
  ip: string
  hostname: string
  notes?: string
  id?: string | null
}
