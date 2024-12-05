import { RuleType, VercelConditionGroup } from './vercelTypes'

export type RuleActionType = 'log' | 'deny' | 'challenge' | 'bypass' | 'rate_limit' | 'redirect'

export interface RuleRateLimit {
  requests: number
  window: string // e.g., "60s", "1h", "1d"
}

export interface RuleRedirect {
  location: string
  permanent?: boolean
}

export interface RuleAction {
  type: RuleActionType
  rateLimit?: RuleRateLimit
  redirect?: RuleRedirect
  duration?: string // e.g., "1h", "1d", "permanent"
}

export interface CustomRule {
  id?: string // Vercel rule ID, present for existing rules
  name: string
  description?: string
  type?: RuleType // Optional as it can be inferred from conditionGroup
  values?: string[] // Optional as it can be inferred from conditionGroup
  conditionGroup?: VercelConditionGroup[] // Full Vercel condition group configuration
  action: RuleAction | RuleActionType // Support both simple string and full config
  active: boolean
}

export interface ProjectConfig {
  projectId?: string
  teamId?: string
}

export interface IPBlockingRule {
  id?: string
  ip: string
  hostname: string
  notes?: string
  action: 'deny' // Currently only 'deny' is supported for IP blocking
}

export interface FirewallConfig extends ProjectConfig {
  rules: CustomRule[]
  ips?: IPBlockingRule[]
  version?: number
  updatedAt?: string
}
