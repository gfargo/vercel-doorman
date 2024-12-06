import { describe, expect, test } from '@jest/globals'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { ValidationService } from '../lib/services/ValidationService'
import { ConditionGroup, CustomRule, FirewallConfig, RuleCondition, RuleType } from '../lib/types'

describe('Example Configurations', () => {
  const examplesDir = join(__dirname, '../../examples')
  const exampleFiles = readdirSync(examplesDir).filter((file) => file.endsWith('.json'))

  test.each(exampleFiles)('validates example: %s', (filename) => {
    // Given
    const validator: ValidationService = ValidationService.getInstance()
    const configPath = join(examplesDir, filename)
    const configContent = readFileSync(configPath, 'utf8')
    const config = JSON.parse(configContent) as FirewallConfig

    // When/Then
    expect(() => {
      validator.validateConfig(config)
    }).not.toThrow()
  })

  test.each(exampleFiles)('example %s contains required fields', (filename) => {
    // Given
    const configPath = join(examplesDir, filename)
    const configContent = readFileSync(configPath, 'utf8')
    const config = JSON.parse(configContent) as FirewallConfig

    // Then
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

  test.each(exampleFiles)('example %s has valid action configurations', (filename) => {
    // Given
    const configPath = join(examplesDir, filename)
    const configContent = readFileSync(configPath, 'utf8')
    const config = JSON.parse(configContent) as FirewallConfig

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
})
