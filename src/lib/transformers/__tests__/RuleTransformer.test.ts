import { ConfigRule } from '../../types/configTypes'
import { VercelRule } from '../../types/vercelTypes'
import { RuleTransformer } from '../RuleTransformer'

describe('RuleTransformer', () => {
  describe('toVercelRule', () => {
    it('should transform a basic IP rule correctly', () => {
      const configRule: ConfigRule = {
        name: 'block-ip',
        description: 'Block specific IP',
        type: 'ip',
        values: ['1.2.3.4'],
        action: 'deny',
        active: true,
      }

      const expected: VercelRule = {
        name: 'block-ip',
        description: 'Block specific IP',
        active: true,
        conditionGroup: [
          {
            conditions: [
              {
                op: 'eq',
                type: 'ip',
                value: '1.2.3.4',
              },
            ],
          },
        ],
        action: {
          mitigate: {
            action: 'deny',
          },
        },
      }

      expect(RuleTransformer.toVercelRule(configRule)).toEqual(expected)
    })

    it('should handle CIDR IP ranges with correct operator', () => {
      const configRule: ConfigRule = {
        name: 'block-network',
        type: 'ip',
        values: ['192.168.1.0/24'],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(configRule)
      expect(result.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('cidr')
    })

    it('should handle path rules with starts_with operator', () => {
      const configRule: ConfigRule = {
        name: 'protect-admin',
        type: 'path',
        values: ['/admin'],
        action: 'challenge',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(configRule)
      expect(result.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('starts_with')
    })

    it('should handle cookie rules with not_exists operator when value is empty', () => {
      const configRule: ConfigRule = {
        name: 'check-cookie',
        type: 'cookie',
        values: [''],
        action: 'challenge',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(configRule)
      expect(result.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('not_exists')
    })

    it('should handle multiple values in a rule', () => {
      const configRule: ConfigRule = {
        name: 'multi-ip',
        type: 'ip',
        values: ['1.1.1.1', '2.2.2.2'],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(configRule)
      expect(result.conditionGroup?.[0]?.conditions).toHaveLength(2)
      expect(result.conditionGroup?.[0]?.conditions.map((c) => c.value)).toEqual(['1.1.1.1', '2.2.2.2'])
    })
  })

  describe('fromVercelRule', () => {
    it('should transform a Vercel rule back to config format', () => {
      const vercelRule: VercelRule = {
        name: 'block-ip',
        description: 'Block specific IP',
        active: true,
        conditionGroup: [
          {
            conditions: [
              {
                op: 'eq',
                type: 'ip',
                value: '1.2.3.4',
              },
            ],
          },
        ],
        action: {
          mitigate: {
            action: 'deny',
          },
        },
      }

      const expected: ConfigRule = {
        name: 'block-ip',
        description: 'Block specific IP',
        type: 'ip',
        values: ['1.2.3.4'],
        action: 'deny',
        active: true,
      }

      expect(RuleTransformer.fromVercelRule(vercelRule)).toEqual(expected)
    })

    it('should handle empty condition groups gracefully', () => {
      const vercelRule: VercelRule = {
        name: 'empty-rule',
        active: true,
        conditionGroup: [],
        action: {
          mitigate: {
            action: 'deny',
          },
        },
      }

      const result = RuleTransformer.fromVercelRule(vercelRule)
      expect(result.type).toBe('ip') // default type
      expect(result.values).toEqual([])
    })

    it('should handle multiple conditions', () => {
      const vercelRule: VercelRule = {
        name: 'multi-ip',
        active: true,
        conditionGroup: [
          {
            conditions: [
              { op: 'eq', type: 'ip', value: '1.1.1.1' },
              { op: 'eq', type: 'ip', value: '2.2.2.2' },
            ],
          },
        ],
        action: {
          mitigate: {
            action: 'deny',
          },
        },
      }

      const result = RuleTransformer.fromVercelRule(vercelRule)
      expect(result.values).toEqual(['1.1.1.1', '2.2.2.2'])
    })

    it('should preserve description when present', () => {
      const vercelRule: VercelRule = {
        name: 'test',
        description: 'Test description',
        active: true,
        conditionGroup: [
          {
            conditions: [{ op: 'eq', type: 'ip', value: '1.1.1.1' }],
          },
        ],
        action: {
          mitigate: {
            action: 'deny',
          },
        },
      }

      const result = RuleTransformer.fromVercelRule(vercelRule)
      expect(result.description).toBe('Test description')
    })
  })
})
