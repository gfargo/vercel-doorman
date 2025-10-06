import { describe, expect, test } from '@jest/globals'
import { ValidationService } from '../lib/services/ValidationService'
import { FirewallConfig, Redirect } from '../lib/types'

describe('Validation Service', () => {
  const validationService = ValidationService.getInstance()

  // Test with a valid firewall configuration
  test('validates a valid firewall configuration', () => {
    const validConfig: FirewallConfig = {
      rules: [
        {
          name: 'Block Bad Bots',
          description: 'Blocks known bad bots based on user agent',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'user_agent',
                  op: 'sub',
                  value: 'BadBot',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'deny',
            },
          },
          active: true,
        },
        {
          name: 'Rate Limit API',
          description: 'Rate limits API requests',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'path',
                  op: 'pre',
                  value: '/api/',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'rate_limit',
              rateLimit: {
                requests: 10,
                window: '1m',
              },
            },
          },
          active: true,
        },
        {
          name: 'Redirect Legacy Path',
          description: 'Redirects old paths to new location',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'path',
                  op: 'eq',
                  value: '/old-path',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'redirect',
              redirect: {
                location: '/new-path',
                permanent: true,
              },
            },
          },
          active: true,
        },
      ],
      ips: [
        {
          ip: '192.168.1.1',
          hostname: 'malicious-host',
          action: 'deny',
        },
      ],
      version: 1,
      firewallEnabled: true,
    }

    expect(() => validationService.validateConfig(validConfig)).not.toThrow()
  })

  // Test invalid configurations
  // Note: Test is skipped because the validation for duplicate rule names
  // occurs after AJV and Zod validation, but our test config has other issues
  // that cause it to fail before reaching this validation
  test('rejects configuration with duplicate rule names', () => {
    const configWithDuplicateNames: FirewallConfig = {
      rules: [
        {
          name: 'Duplicate Name',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'path',
                  op: 'eq',
                  value: '/path1',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'deny',
            },
          },
          active: true,
        },
        {
          name: 'Duplicate Name', // Same name as above
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'path',
                  op: 'eq',
                  value: '/path2',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'deny',
            },
          },
          active: true,
        },
      ],
    }

    expect(() => validationService.validateConfig(configWithDuplicateNames)).toThrow(/duplicate/i)
  })

  test('rejects configuration with invalid rate limit', () => {
    const configWithInvalidRateLimit: FirewallConfig = {
      rules: [
        {
          name: 'Invalid Rate Limit',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'path',
                  op: 'eq',
                  value: '/api',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'rate_limit',
              rateLimit: {
                requests: -10, // Negative requests, should be rejected
                window: '1m',
              },
            },
          },
          active: true,
        },
      ],
    }

    expect(() => validationService.validateConfig(configWithInvalidRateLimit)).toThrow(/positive|requests|rate/i)
  })

  test('rejects configuration with invalid redirect', () => {
    const configWithInvalidRedirect: FirewallConfig = {
      rules: [
        {
          name: 'Invalid Redirect',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'path',
                  op: 'eq',
                  value: '/old',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'redirect',
              redirect: {
                // Missing location property on purpose to test validation
                permanent: true,
              } as unknown as Redirect,
            },
          },
          active: true,
        },
      ],
    }

    expect(() => validationService.validateConfig(configWithInvalidRedirect)).toThrow(/location|redirect/i)
  })

  test('rejects configuration with empty condition group', () => {
    const configWithEmptyConditionGroup: FirewallConfig = {
      rules: [
        {
          name: 'Empty Condition Group',
          conditionGroup: [
            {
              conditions: [], // Empty conditions array
            },
          ],
          action: {
            mitigate: {
              action: 'deny',
            },
          },
          active: true,
        },
      ],
    }

    expect(() => validationService.validateConfig(configWithEmptyConditionGroup)).toThrow(/condition/i)
  })

  // This test is skipped because the IP validation is handled by Zod but our test config
  // has other issues that cause it to fail before reaching IP validation
  test('rejects configuration with invalid IP address', () => {
    const configWithInvalidIP: FirewallConfig = {
      rules: [
        {
          name: 'Invalid IP',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'ip_address',
                  op: 'eq',
                  value: '999.999.999.999', // Invalid IP address
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'deny',
            },
          },
          active: true,
        },
      ],
    }

    // The validation is handled by Zod schema rather than the custom validation
    expect(() => validationService.validateConfig(configWithInvalidIP)).toThrow(/invalid/i)
  })

  test('rejects configuration with invalid action duration', () => {
    const configWithInvalidDuration: FirewallConfig = {
      rules: [
        {
          name: 'Invalid Duration',
          conditionGroup: [
            {
              conditions: [
                {
                  type: 'path',
                  op: 'eq',
                  value: '/api',
                },
              ],
            },
          ],
          action: {
            mitigate: {
              action: 'deny',
              actionDuration: 'forever', // Invalid duration, should be like "1h", "1d" or "permanent"
            },
          },
          active: true,
        },
      ],
    }

    expect(() => validationService.validateConfig(configWithInvalidDuration)).toThrow(/duration|format/i)
  })
})
