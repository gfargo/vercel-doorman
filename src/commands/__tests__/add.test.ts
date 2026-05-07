import { generateRuleId } from '../add'

describe('add command', () => {
  describe('generateRuleId', () => {
    it('converts a simple name to snake_case with rule_ prefix', () => {
      expect(generateRuleId('Block Admin')).toBe('rule_block_admin')
    })

    it('handles multiple spaces and special characters', () => {
      expect(generateRuleId('Block Admin Access')).toBe('rule_block_admin_access')
    })

    it('handles names with numbers', () => {
      expect(generateRuleId('Rate Limit API v2')).toBe('rule_rate_limit_api_v2')
    })

    it('strips leading and trailing underscores', () => {
      expect(generateRuleId('  Block Admin  ')).toBe('rule_block_admin')
    })

    it('handles special characters', () => {
      expect(generateRuleId('Block (Bad) Bots!')).toBe('rule_block_bad_bots')
    })

    it('handles single word', () => {
      expect(generateRuleId('Deny')).toBe('rule_deny')
    })

    it('handles already lowercase input', () => {
      expect(generateRuleId('block admin')).toBe('rule_block_admin')
    })

    it('handles hyphens and dots', () => {
      expect(generateRuleId('block-admin.access')).toBe('rule_block_admin_access')
    })

    it('throws for names with no alphanumeric characters', () => {
      expect(() => generateRuleId('---')).toThrow('Cannot generate rule ID')
      expect(() => generateRuleId('!@#$%')).toThrow('Cannot generate rule ID')
    })
  })
})
