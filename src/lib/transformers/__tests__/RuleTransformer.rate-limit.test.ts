import { ConfigRule } from '../../types/configTypes'
import { RuleTransformer } from '../RuleTransformer'

describe('RuleTransformer Rate Limit Validation', () => {
  it('should validate rate limit requests are positive', () => {
    const ruleWithNegativeRequests: ConfigRule = {
      name: 'test-rule',
      type: 'path',
      values: ['/api'],
      action: {
        type: 'deny',
        rateLimit: {
          requests: -1,
          window: '60s',
        },
      },
      active: true,
    }

    expect(() => RuleTransformer.toVercelRule(ruleWithNegativeRequests)).toThrow(
      'Invalid rate limit configuration: requests must be positive',
    )
  })

  it('should validate rate limit window format', () => {
    const ruleWithInvalidWindow: ConfigRule = {
      name: 'test-rule',
      type: 'path',
      values: ['/api'],
      action: {
        type: 'deny',
        rateLimit: {
          requests: 100,
          window: '60x', // Invalid unit
        },
      },
      active: true,
    }

    expect(() => RuleTransformer.toVercelRule(ruleWithInvalidWindow)).toThrow(
      'Invalid rate limit configuration: invalid window format',
    )
  })

  it('should validate rate limit window values', () => {
    const validWindows = ['60s', '5m', '2h', '1d']
    const invalidWindows = ['60', '-1s', '0m', '24x']

    validWindows.forEach((window) => {
      const rule: ConfigRule = {
        name: 'test-rule',
        type: 'path',
        values: ['/api'],
        action: {
          type: 'deny',
          rateLimit: {
            requests: 100,
            window,
          },
        },
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(rule)).not.toThrow()
    })

    invalidWindows.forEach((window) => {
      const rule: ConfigRule = {
        name: 'test-rule',
        type: 'path',
        values: ['/api'],
        action: {
          type: 'deny',
          rateLimit: {
            requests: 100,
            window,
          },
        },
        active: true,
      }

      expect(() => RuleTransformer.toVercelRule(rule)).toThrow()
    })
  })

  it('should handle missing rate limit fields', () => {
    const ruleWithoutRequests: ConfigRule = {
      name: 'test-rule',
      type: 'path',
      values: ['/api'],
      action: {
        type: 'deny',
        // @ts-expect-error Missing required field
        rateLimit: {
          window: '60s',
        },
      },
      active: true,
    }

    const ruleWithoutWindow: ConfigRule = {
      name: 'test-rule',
      type: 'path',
      values: ['/api'],
      action: {
        type: 'deny',
        // @ts-expect-error Missing required field
        rateLimit: {
          requests: 100,
        },
      },
      active: true,
    }

    expect(() => RuleTransformer.toVercelRule(ruleWithoutRequests)).toThrow()
    expect(() => RuleTransformer.toVercelRule(ruleWithoutWindow)).toThrow()
  })
})
