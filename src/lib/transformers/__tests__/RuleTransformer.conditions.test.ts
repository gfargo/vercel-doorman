import { CustomRule } from '../../types/configTypes'
import { RuleTransformer } from '../RuleTransformer'

describe('RuleTransformer Condition Validation', () => {
  describe('condition group validation', () => {
    it('should require either conditionGroup or type+values', () => {
      const invalidRule: CustomRule = {
        name: 'test-rule',
        action: 'deny',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(invalidRule)).toThrow(
        'Either conditionGroup or type+values must be provided',
      )
    })

    it('should validate non-empty condition groups', () => {
      const emptyGroupRule: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [],
          },
        ],
        action: 'deny',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(emptyGroupRule)).toThrow(
        'Condition group must have at least one condition',
      )
    })

    it('should validate condition value types', () => {
      const ruleWithInvalidValue: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [
              {
                op: 'eq',
                type: 'path',
                value: 123,
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(ruleWithInvalidValue)).toThrow('Condition value must be a string')
    })
  })

  describe('condition type validation', () => {
    it('should validate condition types in groups', () => {
      const invalidTypeRule: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [
              {
                op: 'eq',
                // @ts-expect-error Testing invalid type
                type: 'invalid_type',
                value: 'test',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(invalidTypeRule)).toThrow('Invalid condition type: invalid_type')
    })

    it('should validate condition types in simple rules', () => {
      const invalidTypeRule: CustomRule = {
        name: 'test-rule',
        // @ts-expect-error Testing invalid type
        type: 'invalid_type',
        values: ['test'],
        action: 'deny',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(invalidTypeRule)).toThrow('Invalid condition type: invalid_type')
    })
  })

  describe('complex condition scenarios', () => {
    it('should handle multiple condition groups', () => {
      const multiGroupRule: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [
              {
                op: 'eq',
                type: 'path',
                value: '/api',
              },
            ],
          },
          {
            conditions: [
              {
                op: 'eq',
                type: 'method',
                value: 'POST',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(multiGroupRule)
      expect(result.conditionGroup).toHaveLength(2)
      expect(result.conditionGroup).toBeDefined()
      expect(result.conditionGroup[0]).toBeDefined()
      expect(result.conditionGroup[0]!.conditions).toHaveLength(1)
      expect(result.conditionGroup[1]!.conditions).toHaveLength(1)
    })

    it('should handle multiple conditions in a group', () => {
      const multiConditionRule: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [
              {
                op: 'eq',
                type: 'path',
                value: '/api',
              },
              {
                op: 'eq',
                type: 'method',
                value: 'POST',
              },
              {
                op: 'nex',
                type: 'header',
                value: 'x-api-key',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(multiConditionRule)
      expect(result.conditionGroup[0]!.conditions).toHaveLength(3)
    })

    it('should convert simple rules to condition groups', () => {
      const simpleRule: CustomRule = {
        name: 'test-rule',
        type: 'path',
        values: ['/api/v1', '/api/v2'],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(simpleRule)
      expect(result.conditionGroup).toHaveLength(1)
      expect(result.conditionGroup[0]!.conditions).toHaveLength(2)
      expect(result.conditionGroup[0]!.conditions[0]!.type).toBe('path')
      expect(result.conditionGroup[0]!.conditions[0]!.op).toBe('pre')
      expect(result.conditionGroup[0]!.conditions[0]!.value).toBe('/api/v1')
      expect(result.conditionGroup[0]!.conditions[1]!.value).toBe('/api/v2')
    })
  })
})
