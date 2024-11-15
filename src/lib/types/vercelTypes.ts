export interface VercelCondition {
  op: string
  type: string
  value: string
}

export interface VercelConditionGroup {
  conditions: VercelCondition[]
}

export interface VercelAction {
  mitigate: {
    action: string
  }
}

export interface VercelRule {
  id?: string | null
  active: boolean
  name: string
  description?: string
  conditionGroup: VercelConditionGroup[]
  action: VercelAction
}
