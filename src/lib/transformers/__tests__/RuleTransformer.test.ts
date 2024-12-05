import { CustomRule, RuleAction } from '../../types/configTypes'
import { VercelRule } from '../../types/vercelTypes'
import { RuleTransformer } from '../RuleTransformer'

describe('RuleTransformer', () => {
  describe('toVercelRule', () => {
    it('should transform a legacy rule with simple type and values', () => {
      const configRule: CustomRule = {
        name: 'block-ip',
        description: 'Block specific IP',
        type: 'ip_address',
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
                type: 'ip_address',
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

    it('should preserve existing conditionGroup when provided', () => {
      const configRule: CustomRule = {
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
                op: 'eq',
                type: 'method',
                value: 'POST',
              },
            ],
          },
          {
            conditions: [
              {
                op: 'inc',
                type: 'ip_address',
                value: '192.168.1.0/24',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(configRule)
      expect(result.conditionGroup).toEqual(configRule.conditionGroup)
    })

    it('should handle complex action configuration', () => {
      const configRule: CustomRule = {
        name: 'rate-limit',
        type: 'path',
        values: ['/api'],
        action: {
          type: 'log',
          rateLimit: {
            requests: 100,
            window: '60s',
          },
          duration: '1h',
          redirect: {
            location: 'https://example.com',
          },
        },
        active: true,
      }

      const result = RuleTransformer.toVercelRule(configRule)
      expect(result.action.mitigate).toEqual({
        action: 'log',
        rateLimit: {
          requests: 100,
          window: '60s',
        },
        actionDuration: '1h',
        redirect: {
          location: 'https://example.com',
        },
      })
    })

    it('should preserve rule ID when present', () => {
      const configRule: CustomRule = {
        id: 'fr1_abc123',
        name: 'test-rule',
        type: 'ip_address',
        values: ['1.1.1.1'],
        action: 'deny',
        active: true,
      }

      const result = RuleTransformer.toVercelRule(configRule)
      expect(result.id).toBe('fr1_abc123')
    })
  })

  describe('fromVercelRule', () => {
    it('should transform a Vercel rule with complex conditions', () => {
      const vercelRule: VercelRule = {
        id: 'fr1_abc123',
        name: 'complex-rule',
        description: 'Complex rule with multiple conditions',
        active: true,
        conditionGroup: [
          {
            conditions: [
              {
                op: 'pre',
                type: 'path',
                value: '/api',
              },
              {
                op: 'eq',
                type: 'method',
                value: 'POST',
              },
            ],
          },
          {
            conditions: [
              {
                op: 'inc',
                type: 'ip_address',
                value: '192.168.1.0/24',
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

      const result = RuleTransformer.fromVercelRule(vercelRule)
      expect(result).toEqual({
        id: 'fr1_abc123',
        name: 'complex-rule',
        description: 'Complex rule with multiple conditions',
        active: true,
        conditionGroup: vercelRule.conditionGroup,
        action: { type: 'deny' },
      })
    })

    it('should transform a Vercel rule with complex action configuration', () => {
      const vercelRule: VercelRule = {
        name: 'rate-limit',
        active: true,
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
        action: {
          mitigate: {
            action: 'log',
            rateLimit: {
              requests: 100,
              window: '60s',
            },
            actionDuration: '1h',
            redirect: {
              location: 'https://example.com',
            },
          },
        },
      }

      const expected: RuleAction = {
        type: 'log',
        rateLimit: {
          requests: 100,
          window: '60s',
        },
        duration: '1h',
        redirect: {
          location: 'https://example.com',
        },
      }

      const result = RuleTransformer.fromVercelRule(vercelRule)
      expect(result.action).toEqual(expected)
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
      expect(result.conditionGroup).toEqual([])
      expect(result.action).toEqual({ type: 'deny' })
    })

    it('should handle all supported condition types and operators', () => {
      const vercelRule: VercelRule = {
        name: 'all-conditions',
        active: true,
        conditionGroup: [
          {
            conditions: [
              { op: 're', type: 'host', value: '.*\\.example\\.com' },
              { op: 'eq', type: 'method', value: 'POST' },
              { op: 'neq', type: 'header', value: 'x-test' },
              { op: 'ex', type: 'query', value: 'debug' },
              { op: 'nex', type: 'cookie', value: 'session' },
              { op: 'inc', type: 'ip_address', value: '192.168.1.0/24' },
              { op: 'ninc', type: 'geo_country', value: 'US' },
              { op: 'pre', type: 'path', value: '/api' },
              { op: 'suf', type: 'user_agent', value: 'bot' },
              { op: 'sub', type: 'target_path', value: 'admin' },
              { op: 'gt', type: 'ja4_digest', value: '123' },
              { op: 'gte', type: 'ja3_digest', value: '456' },
              { op: 'lt', type: 'geo_as_number', value: '789' },
              { op: 'lte', type: 'rate_limit_api_id', value: '1000' },
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
      expect(result.conditionGroup && result.conditionGroup[0] && result.conditionGroup[0].conditions).toHaveLength(14)
      expect(result.conditionGroup?.[0]?.conditions.map((c) => c.op) ?? []).toEqual([
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
      ])
    })
  })

  describe('error cases', () => {
    it('should handle missing required fields in config rule', () => {
      const invalidRule = {
        // Missing required 'name' field
        type: 'ip_address',
        values: ['1.1.1.1'],
        action: 'deny',
        active: true,
      } as CustomRule

      expect(() => RuleTransformer.toVercelRule(invalidRule)).toThrow('Rule name is required')
    })

    it('should handle invalid action type', () => {
      const ruleWithInvalidAction: CustomRule = {
        name: 'test-rule',
        type: 'ip_address',
        values: ['1.1.1.1'],
        // @ts-expect-error Invalid action type
        action: 'invalid-action',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(ruleWithInvalidAction)).toThrow('Invalid action type: invalid-action')
    })

    it('should handle invalid condition operator', () => {
      const ruleWithInvalidOp: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [
              {
                // @ts-expect-error Invalid operator
                op: 'invalid-op',
                type: 'ip_address',
                value: '1.1.1.1',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(ruleWithInvalidOp)).toThrow('Invalid operator: invalid-op')
    })

    it('should handle invalid condition type', () => {
      const ruleWithInvalidType: CustomRule = {
        name: 'test-rule',
        conditionGroup: [
          {
            conditions: [
              {
                op: 'eq',
                // @ts-expect-error Invalid condition type
                type: 'invalid-type',
                value: '1.1.1.1',
              },
            ],
          },
        ],
        action: 'deny',
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(ruleWithInvalidType)).toThrow('Invalid condition type: invalid-type')
    })

    // TODO: Uncomment this test after adding rate limit validation
    // it('should handle invalid rate limit configuration', () => {
    //   const ruleWithInvalidRateLimit: ConfigRule = {
    //     name: 'test-rule',
    //     type: 'path',
    //     values: ['/api'],
    //     action: {
    //       type: 'log',
    //       rateLimit: {
    //         requests: -1, // Invalid negative value
    //         window: '60s',
    //       },
    //     },
    //     active: true,
    //   }

    //   expect(() => RuleTransformer.toVercelRule(ruleWithInvalidRateLimit)).toThrow(
    //     'Invalid rate limit configuration: requests must be positive',
    //   )
    // })

    it('should handle invalid redirect configuration', () => {
      const ruleWithInvalidRedirect: CustomRule = {
        name: 'test-rule',
        type: 'path',
        values: ['/old'],
        action: {
          type: 'bypass',
          redirect: {
            // @ts-expect-error Missing required field
            url: 'https://example.com',
          },
        },
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(ruleWithInvalidRedirect)).toThrow(
        'Invalid redirect configuration: url is required',
      )
    })

    it('should handle malformed Vercel rule when converting back', () => {
      const malformedVercelRule = {
        name: 'test',
        active: true,
        action: {
          mitigate: {
            // Missing required action field
            rateLimit: { requests: 100, window: '60s' },
          },
        },
      } as VercelRule

      expect(() => RuleTransformer.fromVercelRule(malformedVercelRule)).toThrow(
        'Missing required action type in Vercel rule',
      )
    })

    it('should handle invalid action duration format', () => {
      const ruleWithInvalidDuration: CustomRule = {
        name: 'test-rule',
        type: 'path',
        values: ['/api'],
        action: {
          type: 'deny',
          duration: 'invalid', // Should be like '1h', '1d', etc.
        },
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(ruleWithInvalidDuration)).toThrow(
        'Invalid action duration format: invalid',
      )
    })
  })
})
