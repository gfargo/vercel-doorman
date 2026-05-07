import { levenshtein, findFuzzyMatches } from '../remove'
import { CustomRule } from '../../lib/types'

describe('remove command', () => {
  describe('levenshtein', () => {
    it('returns 0 for identical strings', () => {
      expect(levenshtein('hello', 'hello')).toBe(0)
    })

    it('returns length of other string when one is empty', () => {
      expect(levenshtein('', 'hello')).toBe(5)
      expect(levenshtein('hello', '')).toBe(5)
    })

    it('returns 1 for single character difference', () => {
      expect(levenshtein('cat', 'bat')).toBe(1)
    })

    it('returns correct distance for insertions', () => {
      expect(levenshtein('cat', 'cats')).toBe(1)
    })

    it('returns correct distance for deletions', () => {
      expect(levenshtein('cats', 'cat')).toBe(1)
    })

    it('handles completely different strings', () => {
      expect(levenshtein('abc', 'xyz')).toBe(3)
    })

    it('is case sensitive', () => {
      expect(levenshtein('Hello', 'hello')).toBe(1)
    })
  })

  describe('findFuzzyMatches', () => {
    const mockRules: CustomRule[] = [
      {
        id: 'rule_block_admin_access',
        name: 'Block Admin Access',
        conditionGroup: [{ conditions: [{ type: 'path', op: 'pre', value: '/admin' }] }],
        action: { mitigate: { action: 'deny' } },
        active: true,
      },
      {
        id: 'rule_block_admin_panel',
        name: 'Block Admin Panel',
        conditionGroup: [{ conditions: [{ type: 'path', op: 'pre', value: '/admin/panel' }] }],
        action: { mitigate: { action: 'deny' } },
        active: true,
      },
      {
        id: 'rule_rate_limit_api',
        name: 'Rate Limit API',
        conditionGroup: [{ conditions: [{ type: 'path', op: 'pre', value: '/api' }] }],
        action: { mitigate: { action: 'rate_limit', rateLimit: { requests: 100, window: '60s' } } },
        active: true,
      },
      {
        id: 'rule_block_bots',
        name: 'Block Bad Bots',
        conditionGroup: [{ conditions: [{ type: 'user_agent', op: 'sub', value: 'bot' }] }],
        action: { mitigate: { action: 'deny' } },
        active: false,
      },
    ]

    it('finds substring matches', () => {
      const results = findFuzzyMatches('Block Admin', mockRules)
      expect(results.length).toBe(2)
      expect(results[0]!.name).toBe('Block Admin Access')
      expect(results[1]!.name).toBe('Block Admin Panel')
    })

    it('finds matches case-insensitively', () => {
      const results = findFuzzyMatches('block admin', mockRules)
      expect(results.length).toBe(2)
    })

    it('returns empty array when no close matches', () => {
      const results = findFuzzyMatches('zzzzzzzzzzzzzzz', mockRules)
      expect(results.length).toBe(0)
    })

    it('limits results to maxResults', () => {
      const results = findFuzzyMatches('Block', mockRules, 1)
      expect(results.length).toBe(1)
    })

    it('finds Levenshtein matches when no substring match', () => {
      const results = findFuzzyMatches('Rate Limit AP', mockRules)
      expect(results.length).toBeGreaterThan(0)
      expect(results.some((r) => r.name === 'Rate Limit API')).toBe(true)
    })

    it('handles empty rules array', () => {
      const results = findFuzzyMatches('anything', [])
      expect(results.length).toBe(0)
    })
  })
})
