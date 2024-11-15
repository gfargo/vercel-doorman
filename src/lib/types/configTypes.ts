export type RuleAction = 'allow' | 'deny' | 'challenge'
export type RuleType = 'ip' | 'asn' | 'path' | 'cookie'

export interface ConfigRule {
  name: string
  description?: string
  type: RuleType
  values: string[]
  action: RuleAction
  active: boolean
}

export interface ProjectConfig {
  projectId?: string
  teamId?: string
}

export interface FirewallConfig extends ProjectConfig {
  rules: ConfigRule[]
}
