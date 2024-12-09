import { describe, expect, test } from '@jest/globals'
import { ValidationService } from '../lib/services/ValidationService'
import { TemplateName, templates } from '../lib/templates'
import { ConditionGroup, CustomRule, RuleCondition, RuleType } from '../lib/types'

describe('Template Configurations', () => {
  const templateNames = Object.keys(templates) as TemplateName[]

  test.each(templateNames)('validates template: %s', (templateName) => {
    // Given
    const validator: ValidationService = ValidationService.getInstance()
    const config = templates[templateName]!.config

    // When/Then
    expect(() => {
      validator.validateConfig(config)
    }).not.toThrow()
  })

  test.each(templateNames)('template %s contains required metadata', (templateName) => {
    const template = templates[templateName]!

    // Validate metadata
    expect(template).toHaveProperty('metadata')
    expect(template.metadata).toHaveProperty('title')
    expect(typeof template.metadata.title).toBe('string')
    expect(template.metadata.title.length).toBeGreaterThan(0)
    expect(template.metadata).toHaveProperty('reference')
    expect(typeof template.metadata.reference).toBe('string')
    expect(template.metadata.reference).toMatch(/^https:\/\/vercel\.com\/templates\//)
  })

  test.each(templateNames)('template %s contains required fields', (templateName) => {
    const config = templates[templateName]!.config

    // Validate config structure
    expect(config).toHaveProperty('rules')
    expect(Array.isArray(config.rules)).toBeTruthy()

    config.rules.forEach((rule: CustomRule) => {
      expect(rule).toHaveProperty('name')
      expect(rule).toHaveProperty('action')
      expect(rule).toHaveProperty('active')
      expect(rule).toHaveProperty('conditionGroup')

      // Validate condition groups
      rule.conditionGroup.forEach((group: ConditionGroup) => {
        expect(group).toHaveProperty('conditions')
        expect(Array.isArray(group.conditions)).toBeTruthy()

        group.conditions.forEach((condition: RuleCondition) => {
          expect(condition).toHaveProperty('op')
          expect(condition).toHaveProperty('type')

          // headers & cookies require a key
          const keyRequired = ['header', 'cookie'] as RuleType[]
          if (keyRequired.includes(condition.type)) {
            expect(condition).toHaveProperty('key')

            if (condition.op !== 'ex' && condition.op !== 'nex') {
              expect(condition).toHaveProperty('value')
            }
          } else {
            expect(condition).toHaveProperty('value')
          }
        })
      })
    })
  })

  test.each(templateNames)('template %s has valid action configurations', (templateName) => {
    const config = templates[templateName]!.config

    config.rules.forEach((rule: CustomRule) => {
      expect(rule.action).toHaveProperty('mitigate')
      const mitigate = rule.action.mitigate

      expect(mitigate).toHaveProperty('action')

      // Validate rate limit if present
      if (mitigate.rateLimit) {
        expect(mitigate.rateLimit).toHaveProperty('requests')
        expect(mitigate.rateLimit).toHaveProperty('window')
        expect(typeof mitigate.rateLimit.requests).toBe('number')
        expect(typeof mitigate.rateLimit.window).toBe('string')
      }

      // Validate redirect if present
      if (mitigate.redirect) {
        expect(mitigate.redirect).toHaveProperty('location')
        expect(typeof mitigate.redirect.location).toBe('string')
      }

      // Validate duration if present
      if (mitigate.actionDuration) {
        expect(typeof mitigate.actionDuration).toBe('string')
        expect(mitigate.actionDuration).toMatch(/^\d+[smhd]$|^permanent$/)
      }
    })
  })

  test.each(templateNames)('template %s has unique rule IDs', (templateName) => {
    const config = templates[templateName]!.config
    const ruleIds = config.rules.map((rule) => rule.id).filter((id): id is string => id !== undefined) // Filter out undefined IDs

    // Skip test if no IDs are defined
    if (ruleIds.length === 0) return

    const uniqueIds = new Set(ruleIds)
    expect(uniqueIds.size).toBe(ruleIds.length)
  })

  test.each(templateNames)('template %s has valid condition types', (templateName) => {
    const config = templates[templateName]!.config
    const validTypes: RuleType[] = [
      'host',
      'path',
      'method',
      'header',
      'query',
      'cookie',
      'target_path',
      'protocol',
      'scheme',
      'ip_address',
      'user_agent',
      'ja4_digest',
      'ja3_digest',
      'geo_continent',
      'geo_country',
      'geo_country_region',
      'geo_city',
      'geo_as_number',
      'environment',
      'rate_limit_api_id',
      'region',
    ]

    config.rules.forEach((rule: CustomRule) => {
      rule.conditionGroup.forEach((group: ConditionGroup) => {
        group.conditions.forEach((condition: RuleCondition) => {
          expect(validTypes).toContain(condition.type)
        })
      })
    })
  })

  test.each(templateNames)('template %s has valid condition operators', (templateName) => {
    const config = templates[templateName]!.config
    const validOperators = ['eq', 'pre', 'suf', 'inc', 'sub', 're', 'ex', 'nex']

    config.rules.forEach((rule: CustomRule) => {
      rule.conditionGroup.forEach((group: ConditionGroup) => {
        group.conditions.forEach((condition: RuleCondition) => {
          expect(validOperators).toContain(condition.op)
        })
      })
    })
  })

  test.each(templateNames)('template %s has valid action types', (templateName) => {
    const config = templates[templateName]!.config
    const validActions = ['log', 'deny', 'redirect']

    config.rules.forEach((rule: CustomRule) => {
      expect(validActions).toContain(rule.action.mitigate.action)
    })
  })
})
