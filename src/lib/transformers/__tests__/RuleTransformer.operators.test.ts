import { CustomRule } from '../../types/configTypes'
import { RuleTransformer } from '../RuleTransformer'

describe('RuleTransformer Operator Handling', () => {
  describe('determineOperator', () => {
    it('should handle IP address operators correctly', () => {
      const cidrRule: CustomRule = {
        name: 'cidr-rule',
        type: 'ip_address',
        values: ['192.168.1.0/24'],
        action: 'deny',
        active: true,
      }

      const singleIpRule: CustomRule = {
        name: 'ip-rule',
        type: 'ip_address',
        values: ['192.168.1.1'],
        action: 'deny',
        active: true,
      }

      const cidrResult = RuleTransformer.toVercelRule(cidrRule)
      const ipResult = RuleTransformer.toVercelRule(singleIpRule)

      expect(cidrResult.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('inc')
      expect(ipResult.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('eq')
    })

    it('should use prefix match for paths', () => {
      const pathRule: CustomRule = {
        name: 'path-rule',
        type: 'path',
        values: ['/api/v1'],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(pathRule)
      expect(result.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('pre')
    })

    it('should handle cookie existence checks', () => {
      const cookieExistsRule: CustomRule = {
        name: 'cookie-rule',
        type: 'cookie',
        values: ['session'],
        action: 'deny',
        active: true,
      }

      const cookieNotExistsRule: CustomRule = {
        name: 'cookie-rule',
        type: 'cookie',
        values: [''],
        action: 'deny',
        active: true,
      }

      const existsResult = RuleTransformer.toVercelRule(cookieExistsRule)
      const notExistsResult = RuleTransformer.toVercelRule(cookieNotExistsRule)

      expect(existsResult.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('eq')
      expect(notExistsResult.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('nex')
    })

    it('should default to equality for other types', () => {
      const types = [
        'method',
        'header',
        'query',
        'target_path',
        'region',
        'protocol',
        'scheme',
        'environment',
        'user_agent',
        'geo_continent',
        'geo_country',
      ]

      types.forEach((type) => {
        const rule: CustomRule = {
          name: `${type}-rule`,
          type: type as CustomRule['type'],
          values: ['test-value'],
          action: 'deny',
          active: true,
        }

        const result = RuleTransformer.toVercelRule(rule)
        expect(result.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('eq')
      })
    })
  })

  describe('complex operator combinations', () => {
    it('should handle multiple conditions with different operators', () => {
      const rule: CustomRule = {
        name: 'complex-rule',
        conditionGroup: [
          {
            conditions: [
              {
                op: 'pre',
                type: 'path',
                value: '/api',
              },
              {
                op: 'inc',
                type: 'ip_address',
                value: '192.168.1.0/24',
              },
              {
                op: 'nex',
                type: 'cookie',
                value: 'session',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(rule)
      expect(result.conditionGroup[0]!.conditions).toHaveLength(3)
      expect(result.conditionGroup[0]!.conditions.map((c) => c.op)).toEqual(['pre', 'inc', 'nex'])
    })

    it('should preserve operator when converting back and forth', () => {
      const originalRule: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [
              {
                op: 'pre',
                type: 'path',
                value: '/api',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      const vercelRule = RuleTransformer.toVercelRule(originalRule)
      const convertedBack = RuleTransformer.fromVercelRule(vercelRule)

      expect(convertedBack.conditionGroup?.[0]?.conditions?.[0]?.op).toBe('pre')
    })
  })
})
