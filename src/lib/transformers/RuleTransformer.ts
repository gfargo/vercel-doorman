import { ConfigRule, RuleType } from '../types/configTypes'
import { VercelCondition, VercelRule } from '../types/vercelTypes'

export class RuleTransformer {
  static toVercelRule(config: ConfigRule): VercelRule {
    return {
      active: config.active,
      name: config.name,
      description: config.description,
      conditionGroup: [
        {
          conditions: config.values.map((value) => this.createCondition(config.type, value)),
        },
      ],
      action: {
        mitigate: {
          action: config.action,
        },
      },
    }
  }

  private static createCondition(type: RuleType, value: string): VercelCondition {
    return {
      op: this.determineOperator(type, value),
      type,
      value,
    }
  }

  private static determineOperator(type: RuleType, value: string): string {
    switch (type) {
      case 'ip':
        return value.includes('/') ? 'cidr' : 'eq'
      case 'path':
        return 'starts_with'
      case 'cookie':
        return value === '' ? 'not_exists' : 'eq'
      default:
        return 'eq'
    }
  }

  static fromVercelRule(rule: VercelRule): ConfigRule {
    // This will be useful for the sync functionality
    // when we need to compare existing rules with our config
    const conditions = rule.conditionGroup[0]?.conditions || []
    return {
      name: rule.name,
      description: rule.description,
      type: (conditions[0]?.type as RuleType) || 'ip',
      values: conditions.map((c) => c.value),
      action: rule.action.mitigate.action as 'allow' | 'deny' | 'challenge',
      active: rule.active,
    }
  }
}
