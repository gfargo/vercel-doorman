import { describe, expect, test } from '@jest/globals'
import { convertToSnakeCase } from '../toSnakeCase'

describe('convertToSnakeCase', () => {
  test('converts camelCase to snake_case', () => {
    expect(convertToSnakeCase('camelCase')).toBe('camel_case')
    expect(convertToSnakeCase('thisIsATest')).toBe('this_is_a_test')
    expect(convertToSnakeCase('ABC')).toBe('a_b_c')
    expect(convertToSnakeCase('alreadysnakecase')).toBe('alreadysnakecase')
  })

  test('handles spaces and special characters', () => {
    expect(convertToSnakeCase('This is a test')).toBe('this_is_a_test')
    expect(convertToSnakeCase('This-is-a-test')).toBe('this_is_a_test')
    expect(convertToSnakeCase('This_is_a_test')).toBe('this_is_a_test')
    expect(convertToSnakeCase('This_is_a_test ')).toBe('this_is_a_test')
    expect(convertToSnakeCase('This.is.a.test')).toBe('this_is_a_test')
    expect(convertToSnakeCase('This_is_a_"test"!')).toBe('this_is_a_test')
    expect(convertToSnakeCase('This_is_a_"/123/"_test"')).toBe('this_is_a_123_test')
  })

  test('handles edge cases', () => {
    expect(convertToSnakeCase('')).toBe('')
    expect(convertToSnakeCase(' ')).toBe('')
    expect(convertToSnakeCase('___')).toBe('')
    expect(convertToSnakeCase('   test   ')).toBe('test')
  })

  test('handles mixed formats', () => {
    expect(convertToSnakeCase('mixedCase-with.special_characters')).toBe('mixed_case_with_special_characters')
    expect(convertToSnakeCase('XMLHttpRequest')).toBe('xml_http_request')
    expect(convertToSnakeCase('iPhone6Plus')).toBe('i_phone6_plus')
  })

  test('handles firewall rule related strings', () => {
    expect(convertToSnakeCase('blockIPAddress')).toBe('block_ip_address')
    expect(convertToSnakeCase('GeoLocation')).toBe('geo_location')
    expect(convertToSnakeCase('RateLimitRule')).toBe('rate_limit_rule')
    expect(convertToSnakeCase('HTTP2Only')).toBe('http2_only')
    expect(convertToSnakeCase('APIKeyAuth')).toBe('api_key_auth')
  })
})
