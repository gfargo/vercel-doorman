import { describe, expect, test } from '@jest/globals'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { ValidationService } from '../lib/services/ValidationService'
import { ConfigRule, FirewallConfig, RuleAction } from '../lib/types/configTypes'
import { VercelCondition, VercelConditionGroup } from '../lib/types/vercelTypes'

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

    config.rules.forEach((rule: ConfigRule) => {
      expect(rule).toHaveProperty('name')
      expect(rule).toHaveProperty('action')
      expect(rule).toHaveProperty('active')

      // If using simple values array, must have type
      if (rule.values && !rule.conditionGroup) {
        expect(rule).toHaveProperty('type')
      }

      // If using condition groups, each condition must be valid
      if (rule.conditionGroup) {
        rule.conditionGroup.forEach((group: VercelConditionGroup) => {
          expect(group).toHaveProperty('conditions')
          expect(Array.isArray(group.conditions)).toBeTruthy()

          group.conditions.forEach((condition: VercelCondition) => {
            expect(condition).toHaveProperty('op')
            expect(condition).toHaveProperty('type')
            expect(condition).toHaveProperty('value')
          })
        })
      }
    })
  })

  test.each(exampleFiles)('example %s has valid action configurations', (filename) => {
    // Given
    const configPath = join(examplesDir, filename)
    const configContent = readFileSync(configPath, 'utf8')
    const config = JSON.parse(configContent) as FirewallConfig

    config.rules.forEach((rule: ConfigRule) => {
      if (typeof rule.action === 'object') {
        const action = rule.action as RuleAction
        expect(action).toHaveProperty('type')

        // Validate rate limit if present
        if (action.rateLimit) {
          expect(action.rateLimit).toHaveProperty('requests')
          expect(action.rateLimit).toHaveProperty('window')
          expect(typeof action.rateLimit.requests).toBe('number')
          expect(typeof action.rateLimit.window).toBe('string')
        }

        // Validate redirect if present
        if (action.redirect) {
          expect(action.redirect).toHaveProperty('location')
          expect(typeof action.redirect.location).toBe('string')
        }

        // Validate duration if present
        if (action.duration) {
          expect(typeof action.duration).toBe('string')
          expect(action.duration).toMatch(/^\d+[smhd]$|^permanent$/)
        }
      } else {
        // If action is a string, it must be a valid RuleActionType
        expect(['allow', 'deny', 'challenge', 'log']).toContain(rule.action)
      }
    })
  })
})
