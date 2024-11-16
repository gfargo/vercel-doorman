import { ConfigRule, RuleAction, RuleActionType } from '../types/configTypes'
import { RuleOperator, RuleType, VercelAction, VercelCondition, VercelRule } from '../types/vercelTypes'

export class RuleTransformer {
  static validateActionType(action: string): asserts action is RuleActionType {
    const validActions = ['allow', 'deny', 'challenge', 'log']
    if (!validActions.includes(action)) {
      throw new Error(`Invalid action type: ${action}`)
    }
  }

  static validateOperator(op: string): asserts op is RuleOperator {
    const validOperators = [
      're',
      'eq',
      'neq',
      'ex',
      'nex',
      'inc',
      'ninc',
      'pre',
      'suf',
      'sub',
      'gt',
      'gte',
      'lt',
      'lte',
    ]
    if (!validOperators.includes(op)) {
      throw new Error(`Invalid operator: ${op}`)
    }
  }

  static validateConditionType(type: string): asserts type is RuleType {
    const validTypes = [
      'host',
      'path',
      'method',
      'header',
      'query',
      'cookie',
      'target_path',
      'ip_address',
      'region',
      'protocol',
      'scheme',
      'environment',
      'user_agent',
      'geo_continent',
      'geo_country',
      'geo_country_region',
      'geo_city',
      'geo_as_number',
      'ja4_digest',
      'ja3_digest',
      'rate_limit_api_id',
    ]
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid condition type: ${type}`)
    }
  }

  // TODO: Implement rate limit validation
  // private static validateRateLimit(rateLimit: { requests: number; window: string }) {
  //   if (typeof rateLimit.requests !== 'number' || rateLimit.requests <= 0) {
  //     throw new Error('Invalid rate limit configuration: requests must be positive')
  //   }
  //   if (typeof rateLimit.window !== 'string' || !/^\d+[smhd]$/.test(rateLimit.window)) {
  //     throw new Error('Invalid rate limit configuration: invalid window format')
  //   }
  // }

  static validateRedirect(redirect: { location: string; permanent?: boolean }) {
    if (typeof redirect.location !== 'string' || !redirect.location) {
      throw new Error('Invalid redirect configuration: url is required')
    }
  }

  static validateDuration(duration: string) {
    if (!/^\d+[smhd]$|^permanent$/.test(duration)) {
      throw new Error(`Invalid action duration format: ${duration}`)
    }
  }

  static validateConfigRule(rule: ConfigRule) {
    if (!rule.name) {
      throw new Error('Rule name is required')
    }

    if (!rule.active && rule.active !== false) {
      throw new Error('Rule active status is required')
    }

    // Validate action
    if (typeof rule.action === 'string') {
      this.validateActionType(rule.action)
    } else if (typeof rule.action === 'object') {
      this.validateActionType(rule.action.type)
      // if (rule.action.rateLimit) {
      //   this.validateRateLimit(rule.action.rateLimit)
      // }
      if (rule.action.redirect) {
        this.validateRedirect(rule.action.redirect)
      }
      if (rule.action.duration) {
        this.validateDuration(rule.action.duration)
      }
    } else {
      throw new Error('Rule action is required')
    }

    // Validate condition groups if present
    if (rule.conditionGroup) {
      rule.conditionGroup.forEach((group) => {
        if (!Array.isArray(group.conditions) || group.conditions.length === 0) {
          throw new Error('Condition group must have at least one condition')
        }
        group.conditions.forEach((condition) => {
          this.validateOperator(condition.op)
          this.validateConditionType(condition.type)
          if (typeof condition.value !== 'string') {
            throw new Error('Condition value must be a string')
          }
        })
      })
    } else if (!rule.type || !rule.values) {
      throw new Error('Either conditionGroup or type+values must be provided')
    }
  }

  static transformActionToVercel(action: RuleAction | RuleActionType): VercelAction {
    if (typeof action === 'string') {
      this.validateActionType(action)
      return {
        mitigate: {
          action,
        },
      }
    }

    this.validateActionType(action.type)
    // if (action.rateLimit) {
    //   this.validateRateLimit(action.rateLimit)
    // }
    if (action.redirect) {
      this.validateRedirect(action.redirect)
    }
    if (action.duration) {
      this.validateDuration(action.duration)
    }

    return {
      mitigate: {
        action: action.type,
        rateLimit: action.rateLimit,
        redirect: action.redirect,
        actionDuration: action.duration,
      },
    }
  }

  static toVercelRule(config: ConfigRule): VercelRule {
    this.validateConfigRule(config)

    return {
      ...(config.id && { id: config.id }),
      active: config.active,
      name: config.name,
      description: config.description,
      conditionGroup: config.conditionGroup || [
        {
          conditions: config.values?.map((value) => this.createCondition(config.type || 'ip_address', value)) || [],
        },
      ],
      action: this.transformActionToVercel(config.action),
    }
  }

  private static createCondition(type: RuleType, value: string): VercelCondition {
    this.validateConditionType(type)
    return {
      op: this.determineOperator(type, value),
      type,
      value,
    }
  }

  private static determineOperator(type: RuleType, value: string): RuleOperator {
    switch (type) {
      case 'ip_address':
        return value.includes('/') ? 'inc' : 'eq'
      case 'path':
        return 'pre'
      case 'cookie':
        return value === '' ? 'nex' : 'eq'
      default:
        return 'eq'
    }
  }

  static validateVercelRule(rule: VercelRule) {
    if (!rule.name) {
      throw new Error('Rule name is required')
    }
    if (!rule.action?.mitigate?.action) {
      throw new Error('Missing required action type in Vercel rule')
    }
    this.validateActionType(rule.action.mitigate.action)
  }

  static transformActionFromVercel(action: VercelAction): RuleAction {
    const { mitigate } = action
    if (!mitigate.action) {
      throw new Error('Missing required action type in Vercel rule')
    }

    this.validateActionType(mitigate.action)

    // If only action is present, return simple type
    if (Object.keys(mitigate).length === 1 && mitigate.action) {
      return {
        type: mitigate.action,
      }
    }

    // Validate complex configuration
    // if (mitigate.rateLimit) {
    //   this.validateRateLimit(mitigate.rateLimit)
    // }
    if (mitigate.redirect) {
      this.validateRedirect(mitigate.redirect)
    }
    if (mitigate.actionDuration) {
      this.validateDuration(mitigate.actionDuration)
    }

    // Return full action configuration
    return {
      type: mitigate.action,
      ...(mitigate.rateLimit && { rateLimit: mitigate.rateLimit }),
      ...(mitigate.redirect && { redirect: mitigate.redirect }),
      ...(mitigate.actionDuration && { duration: mitigate.actionDuration }),
    }
  }

  static fromVercelRule(rule: VercelRule): ConfigRule {
    this.validateVercelRule(rule)

    return {
      id: rule.id || undefined,
      name: rule.name,
      description: rule.description,
      conditionGroup: rule.conditionGroup,
      action: this.transformActionFromVercel(rule.action),
      active: rule.active,
    }
  }
}
