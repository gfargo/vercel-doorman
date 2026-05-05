import {
  cloudflareActionSchema,
  cloudflareExpressionSchema,
  cloudflareRuleSchema,
  cloudflareRulesetSchema,
  cloudflareZoneConfigSchema,
  cloudflareRateLimitSchema,
  cloudflareRulesetKindSchema,
  cloudflareRulesetPhaseSchema,
} from '../cloudflareSchemas'

describe('cloudflareSchemas', () => {
  describe('cloudflareActionSchema', () => {
    it('accepts all valid actions', () => {
      const validActions = [
        'block',
        'challenge',
        'managed_challenge',
        'js_challenge',
        'log',
        'skip',
        'allow',
        'rewrite',
        'redirect',
      ]
      for (const action of validActions) {
        expect(cloudflareActionSchema.safeParse(action).success).toBe(true)
      }
    })

    it('rejects invalid actions', () => {
      expect(cloudflareActionSchema.safeParse('deny').success).toBe(false)
      expect(cloudflareActionSchema.safeParse('').success).toBe(false)
    })
  })

  describe('cloudflareExpressionSchema', () => {
    it('accepts valid expressions', () => {
      expect(cloudflareExpressionSchema.safeParse('ip.src eq 1.2.3.4').success).toBe(true)
      expect(cloudflareExpressionSchema.safeParse('http.request.uri.path contains "/api"').success).toBe(true)
    })

    it('rejects empty expressions', () => {
      expect(cloudflareExpressionSchema.safeParse('').success).toBe(false)
    })

    it('rejects whitespace-only expressions', () => {
      expect(cloudflareExpressionSchema.safeParse('   ').success).toBe(false)
    })
  })

  describe('cloudflareRateLimitSchema', () => {
    it('accepts valid rate limit config', () => {
      const result = cloudflareRateLimitSchema.safeParse({
        characteristics: ['ip.src'],
        period: 60,
        requests_per_period: 100,
      })
      expect(result.success).toBe(true)
    })

    it('accepts rate limit with optional fields', () => {
      const result = cloudflareRateLimitSchema.safeParse({
        characteristics: ['ip.src', 'cf.colo.id'],
        period: 60,
        requests_per_period: 100,
        mitigation_timeout: 3600,
        counting_expression: 'http.request.uri.path contains "/api"',
      })
      expect(result.success).toBe(true)
    })

    it('rejects empty characteristics', () => {
      const result = cloudflareRateLimitSchema.safeParse({
        characteristics: [],
        period: 60,
        requests_per_period: 100,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-positive period', () => {
      const result = cloudflareRateLimitSchema.safeParse({
        characteristics: ['ip.src'],
        period: 0,
        requests_per_period: 100,
      })
      expect(result.success).toBe(false)
    })

    it('rejects non-positive requests_per_period', () => {
      const result = cloudflareRateLimitSchema.safeParse({
        characteristics: ['ip.src'],
        period: 60,
        requests_per_period: -1,
      })
      expect(result.success).toBe(false)
    })
  })

  describe('cloudflareRuleSchema', () => {
    it('accepts a valid rule', () => {
      const result = cloudflareRuleSchema.safeParse({
        id: 'rule-1',
        action: 'block',
        expression: 'ip.src eq 1.2.3.4',
        description: 'Block bad IP',
        enabled: true,
      })
      expect(result.success).toBe(true)
    })

    it('defaults enabled to true', () => {
      const result = cloudflareRuleSchema.safeParse({
        id: 'rule-1',
        action: 'block',
        expression: 'ip.src eq 1.2.3.4',
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.enabled).toBe(true)
      }
    })

    it('accepts rule with ratelimit', () => {
      const result = cloudflareRuleSchema.safeParse({
        id: 'rule-1',
        action: 'block',
        expression: 'http.request.uri.path contains "/api"',
        ratelimit: {
          characteristics: ['ip.src'],
          period: 60,
          requests_per_period: 100,
        },
      })
      expect(result.success).toBe(true)
    })

    it('rejects rule with invalid action', () => {
      const result = cloudflareRuleSchema.safeParse({
        id: 'rule-1',
        action: 'invalid_action',
        expression: 'ip.src eq 1.2.3.4',
      })
      expect(result.success).toBe(false)
    })

    it('rejects rule with empty expression', () => {
      const result = cloudflareRuleSchema.safeParse({
        id: 'rule-1',
        action: 'block',
        expression: '',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('cloudflareRulesetKindSchema', () => {
    it('accepts valid kinds', () => {
      for (const kind of ['root', 'zone', 'custom', 'managed']) {
        expect(cloudflareRulesetKindSchema.safeParse(kind).success).toBe(true)
      }
    })

    it('rejects invalid kinds', () => {
      expect(cloudflareRulesetKindSchema.safeParse('invalid').success).toBe(false)
    })
  })

  describe('cloudflareRulesetPhaseSchema', () => {
    it('accepts valid phases', () => {
      const phases = [
        'http_request_firewall_custom',
        'http_request_firewall_managed',
        'http_ratelimit',
        'http_request_transform',
        'http_response_headers_transform',
      ]
      for (const phase of phases) {
        expect(cloudflareRulesetPhaseSchema.safeParse(phase).success).toBe(true)
      }
    })
  })

  describe('cloudflareZoneConfigSchema', () => {
    it('accepts valid zone config with zoneId', () => {
      const result = cloudflareZoneConfigSchema.safeParse({ zoneId: 'zone-123' })
      expect(result.success).toBe(true)
    })

    it('accepts zone config with optional accountId', () => {
      const result = cloudflareZoneConfigSchema.safeParse({
        zoneId: 'zone-123',
        accountId: 'account-123',
      })
      expect(result.success).toBe(true)
    })

    it('rejects missing zoneId', () => {
      const result = cloudflareZoneConfigSchema.safeParse({})
      expect(result.success).toBe(false)
    })

    it('rejects empty zoneId', () => {
      const result = cloudflareZoneConfigSchema.safeParse({ zoneId: '' })
      expect(result.success).toBe(false)
    })
  })

  describe('cloudflareRulesetSchema', () => {
    it('accepts a valid ruleset', () => {
      const result = cloudflareRulesetSchema.safeParse({
        id: 'rs-1',
        name: 'My Ruleset',
        kind: 'custom',
        version: '1',
        phase: 'http_request_firewall_custom',
        rules: [],
      })
      expect(result.success).toBe(true)
    })

    it('rejects ruleset with empty name', () => {
      const result = cloudflareRulesetSchema.safeParse({
        id: 'rs-1',
        name: '',
        kind: 'custom',
        version: '1',
        phase: 'http_request_firewall_custom',
        rules: [],
      })
      expect(result.success).toBe(false)
    })
  })
})
