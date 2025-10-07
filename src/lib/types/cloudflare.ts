/**
 * Cloudflare WAF specific types
 * These types map to Cloudflare's Ruleset Engine API
 */

/**
 * Cloudflare ruleset kind
 */
export type CloudflareRulesetKind = 'root' | 'zone' | 'custom' | 'managed'

/**
 * Cloudflare ruleset phase
 */
export type CloudflareRulesetPhase =
  | 'http_request_firewall_custom'
  | 'http_request_firewall_managed'
  | 'http_ratelimit'
  | 'http_request_transform'
  | 'http_response_headers_transform'

/**
 * Cloudflare rule action types
 */
export type CloudflareAction =
  | 'block'
  | 'challenge'
  | 'managed_challenge'
  | 'js_challenge'
  | 'log'
  | 'skip'
  | 'allow'
  | 'rewrite'
  | 'redirect'

/**
 * Cloudflare action parameters for block actions
 */
export interface CloudflareBlockActionParameters {
  response?: {
    status_code: number
    content: string
    content_type: string
  }
}

/**
 * Cloudflare action parameters for redirect actions
 */
export interface CloudflareRedirectActionParameters {
  from_value: {
    status_code: number
    target_url: {
      value: string
    }
    preserve_query_string?: boolean
  }
}

/**
 * Cloudflare rate limit configuration
 */
export interface CloudflareRateLimit {
  characteristics: string[] // e.g., ["ip.src", "cf.colo.id"]
  period: number // seconds
  requests_per_period: number
  mitigation_timeout?: number // seconds
  counting_expression?: string
}

/**
 * Cloudflare skip action parameters
 */
export interface CloudflareSkipActionParameters {
  ruleset?: string
  phases?: string[]
  products?: string[]
  rules?: { [rulesetId: string]: string[] }
}

/**
 * Cloudflare action parameters union
 */
export type CloudflareActionParameters =
  | CloudflareBlockActionParameters
  | CloudflareRedirectActionParameters
  | CloudflareSkipActionParameters

/**
 * Cloudflare rule
 */
export interface CloudflareRule {
  id: string
  version?: string
  action: CloudflareAction
  expression: string // Wirefilter expression
  description?: string
  enabled?: boolean
  categories?: string[]
  last_updated?: string
  ref?: string // Reference to managed rule
  action_parameters?: CloudflareActionParameters
  ratelimit?: CloudflareRateLimit
}

/**
 * Cloudflare ruleset
 */
export interface CloudflareRuleset {
  id: string
  name: string
  description?: string
  kind: CloudflareRulesetKind
  version: string
  phase: CloudflareRulesetPhase
  rules: CloudflareRule[]
  last_updated?: string
}

/**
 * Cloudflare zone configuration
 */
export interface CloudflareZoneConfig {
  zoneId: string
  accountId?: string
}

/**
 * Cloudflare firewall configuration
 */
export interface CloudflareFirewallConfig extends CloudflareZoneConfig {
  $schema?: string
  version?: string
  rulesets?: CloudflareRuleset[]
  rules?: CloudflareRule[] // Simplified format - single custom ruleset
  updatedAt?: string
}

/**
 * Cloudflare API response wrapper
 */
export interface CloudflareAPIResponse<T> {
  success: boolean
  errors: CloudflareAPIError[]
  messages: CloudflareAPIMessage[]
  result: T
  result_info?: CloudflareResultInfo
}

/**
 * Cloudflare API error
 */
export interface CloudflareAPIError {
  code: number
  message: string
  error_chain?: CloudflareAPIError[]
}

/**
 * Cloudflare API message
 */
export interface CloudflareAPIMessage {
  code: number
  message: string
}

/**
 * Cloudflare API result info (pagination)
 */
export interface CloudflareResultInfo {
  page: number
  per_page: number
  count: number
  total_count: number
  total_pages: number
}

/**
 * Create ruleset request
 */
export interface CloudflareCreateRulesetRequest {
  name: string
  kind: CloudflareRulesetKind
  phase: CloudflareRulesetPhase
  description?: string
  rules?: Omit<CloudflareRule, 'id' | 'version' | 'last_updated'>[]
}

/**
 * Update ruleset request
 */
export interface CloudflareUpdateRulesetRequest {
  name?: string
  description?: string
  rules?: CloudflareRule[]
}

/**
 * Create rule request
 */
export interface CloudflareCreateRuleRequest extends Omit<CloudflareRule, 'id' | 'version' | 'last_updated'> {}

/**
 * Update rule request
 */
export interface CloudflareUpdateRuleRequest extends Partial<CloudflareRule> {}

/**
 * Wirefilter expression field types
 */
export type CloudflareFieldType =
  | 'http.request.uri.path'
  | 'http.request.uri.query'
  | 'http.request.method'
  | 'http.request.headers'
  | 'http.request.body.raw'
  | 'http.host'
  | 'http.user_agent'
  | 'http.referer'
  | 'http.cookie'
  | 'ip.src'
  | 'ip.geoip.country'
  | 'ip.geoip.continent'
  | 'ip.geoip.subdivision_1'
  | 'ip.geoip.city'
  | 'ip.geoip.asnum'
  | 'cf.bot_management.score'
  | 'cf.threat_score'
  | 'cf.tls_version'
  | 'cf.tls_cipher'
  | 'ssl'
