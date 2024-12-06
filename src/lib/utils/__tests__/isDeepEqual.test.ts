import { describe, expect, test } from '@jest/globals'
import { isDeepEqual } from '../isDeepEqual'

describe('isDeepEqual', () => {
  test('compares primitive values', () => {
    expect(isDeepEqual(1, 1)).toBe(true)
    expect(isDeepEqual('test', 'test')).toBe(true)
    expect(isDeepEqual(true, true)).toBe(true)
    expect(isDeepEqual(null, null)).toBe(true)
    expect(isDeepEqual(undefined, undefined)).toBe(true)

    expect(isDeepEqual(1, 2)).toBe(false)
    expect(isDeepEqual('test', 'other')).toBe(false)
    expect(isDeepEqual(true, false)).toBe(false)
    expect(isDeepEqual(null, undefined)).toBe(false)
  })

  test('compares simple objects', () => {
    expect(isDeepEqual({ a: 1 }, { a: 1 })).toBe(true)
    expect(isDeepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true)
    expect(isDeepEqual({ a: 1 }, { a: 2 })).toBe(false)
    expect(isDeepEqual({ a: 1 }, { b: 1 })).toBe(false)
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  test('compares arrays', () => {
    expect(isDeepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(isDeepEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(isDeepEqual([1, 2, 3], [1, 3, 2])).toBe(false)
  })

  test('compares nested objects', () => {
    expect(isDeepEqual({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)

    expect(isDeepEqual({ a: { b: 1 }, c: { d: 2 } }, { a: { b: 1 }, c: { d: 2 } })).toBe(true)

    expect(isDeepEqual({ a: { b: 1 } }, { a: { b: 2 } })).toBe(false)
  })

  test('compares objects with arrays', () => {
    expect(isDeepEqual({ a: [1, 2, { b: 3 }] }, { a: [1, 2, { b: 3 }] })).toBe(true)

    expect(isDeepEqual({ a: [1, 2, { b: 3 }] }, { a: [1, 2, { b: 4 }] })).toBe(false)
  })

  test('handles edge cases', () => {
    expect(isDeepEqual({}, {})).toBe(true)
    expect(isDeepEqual([], [])).toBe(true)
    expect(isDeepEqual({}, [])).toBe(false)
    expect(isDeepEqual(null, {})).toBe(false)
    expect(isDeepEqual(undefined, null)).toBe(false)
  })

  test('compares firewall rule examples', () => {
    const rule1 = {
      name: 'Test Rule',
      conditionGroup: [
        {
          conditions: [
            {
              op: 'eq',
              type: 'ip_address',
              value: '1.1.1.1',
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
    }

    const rule2 = {
      name: 'Test Rule',
      conditionGroup: [
        {
          conditions: [
            {
              op: 'eq',
              type: 'ip_address',
              value: '1.1.1.1',
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
    }

    const rule3 = {
      name: 'Test Rule',
      conditionGroup: [
        {
          conditions: [
            {
              op: 'eq',
              type: 'ip_address',
              value: '1.1.1.1',
            },
          ],
        },
      ],
      action: {
        mitigate: {
          action: 'deny',
          actionDuration: '1h',
        },
      },
      active: true,
    }

    expect(isDeepEqual(rule1, rule2)).toBe(true)
    expect(isDeepEqual(rule1, rule3)).toBe(false)
  })
})
