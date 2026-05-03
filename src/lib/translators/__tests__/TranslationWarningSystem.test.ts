import { TranslationWarningSystem } from '../TranslationWarningSystem'
import type { TranslationWarning } from '../RuleTranslator'

describe('TranslationWarningSystem', () => {
  describe('createWarning', () => {
    it('should create a warning for known warning types', () => {
      const warning = TranslationWarningSystem.createWarning('managed_rules', 'rule-123', 'conditions')

      expect(warning).toMatchObject({
        rule: 'rule-123',
        field: 'conditions',
        category: 'feature_unsupported',
        severity: 'critical',
        message: 'managed rules translation issue',
        explanation: expect.stringContaining('Managed rules are provider-specific'),
        suggestion: expect.stringContaining('Replace with custom rules'),
        alternativeApproach: expect.stringContaining('Create custom rules'),
        impact: expect.stringContaining('Security coverage may be reduced'),
        docsUrl: expect.stringContaining('/migration/managed-rules'),
      })
    })

    it('should create a fallback warning for unknown warning types', () => {
      const warning = TranslationWarningSystem.createWarning('unknown_feature', 'rule-456')

      expect(warning).toMatchObject({
        rule: 'rule-456',
        category: 'compatibility_issue',
        severity: 'warning',
        message: 'Unknown translation issue: unknown_feature',
        explanation: 'This translation scenario is not fully documented.',
        suggestion: 'Review the translated configuration manually and test thoroughly.',
        docsUrl: expect.stringContaining('/migration/troubleshooting'),
      })
    })

    it('should accept custom message and suggestion', () => {
      const warning = TranslationWarningSystem.createWarning(
        'rate_limiting_precision',
        'rule-789',
        'rateLimit',
        'Custom message',
        'Custom suggestion'
      )

      expect(warning.message).toBe('Custom message')
      expect(warning.suggestion).toBe('Custom suggestion')
    })
  })

  describe('createUnsupportedFeatureWarning', () => {
    it('should create an unsupported feature warning', () => {
      const warning = TranslationWarningSystem.createUnsupportedFeatureWarning(
        'bot_management',
        'vercel',
        'cloudflare',
        'rule-123',
        'botManagement'
      )

      expect(warning).toMatchObject({
        rule: 'rule-123',
        field: 'botManagement',
        category: 'feature_unsupported',
        severity: 'critical',
        message: 'bot_management is not supported in cloudflare',
        explanation: expect.stringContaining('bot_management feature from vercel cannot be directly translated'),
        suggestion: expect.stringContaining('Remove or replace bot_management'),
        alternativeApproach: expect.stringContaining('Check cloudflare documentation'),
        impact: 'This rule may not work as expected or may be ignored entirely.',
      })
    })
  })

  describe('createLossyConversionWarning', () => {
    it('should create a lossy conversion warning', () => {
      const warning = TranslationWarningSystem.createLossyConversionWarning(
        'complex_expression',
        'syntax differences between providers',
        'rule-456',
        'expression'
      )

      expect(warning).toMatchObject({
        rule: 'rule-456',
        field: 'expression',
        category: 'lossy_conversion',
        severity: 'warning',
        message: 'complex_expression translation may be lossy',
        explanation: expect.stringContaining('syntax differences between providers'),
        suggestion: 'Review the translated configuration and test thoroughly to ensure it behaves as expected.',
        alternativeApproach: 'Consider simplifying the configuration or using more portable alternatives.',
        impact: 'The translated rule may behave differently than the original.',
      })
    })
  })

  describe('createSyntaxLimitationWarning', () => {
    it('should create a syntax limitation warning', () => {
      const warning = TranslationWarningSystem.createSyntaxLimitationWarning(
        'regex_pattern',
        'lookahead assertions not supported',
        'rule-789',
        'pattern'
      )

      expect(warning).toMatchObject({
        rule: 'rule-789',
        field: 'pattern',
        category: 'syntax_limitation',
        severity: 'warning',
        message: 'regex_pattern has syntax limitations',
        explanation: expect.stringContaining('lookahead assertions not supported'),
        suggestion: 'Verify the translated syntax works correctly in the target provider.',
        alternativeApproach: 'Use simpler syntax or alternative approaches that are more widely supported.',
        impact: 'The rule may not match traffic as precisely as intended.',
      })
    })
  })

  describe('createPerformanceWarning', () => {
    it('should create a performance warning', () => {
      const warning = TranslationWarningSystem.createPerformanceWarning(
        'large_ip_list',
        'may slow down rule evaluation',
        'rule-101',
        'ipList'
      )

      expect(warning).toMatchObject({
        rule: 'rule-101',
        field: 'ipList',
        category: 'performance_impact',
        severity: 'info',
        message: 'large_ip_list may impact performance',
        explanation: expect.stringContaining('may slow down rule evaluation'),
        suggestion: 'Monitor performance after deployment and optimize if necessary.',
        alternativeApproach: expect.stringContaining('more efficient alternatives'),
        impact: 'Request processing may be slower than expected.',
      })
    })
  })

  describe('formatWarning', () => {
    it('should format a warning with all fields', () => {
      const warning: TranslationWarning = {
        rule: 'rule-123',
        field: 'conditions',
        category: 'feature_unsupported',
        severity: 'critical',
        message: 'Test warning',
        explanation: 'This is a test explanation',
        suggestion: 'This is a test suggestion',
        alternativeApproach: 'This is an alternative approach',
        impact: 'This is the impact',
        docsUrl: 'https://docs.example.com/test',
      }

      const formatted = TranslationWarningSystem.formatWarning(warning)

      expect(formatted).toContain('🚨 CRITICAL: Test warning (Rule: rule-123, Field: conditions)')
      expect(formatted).toContain('This is a test explanation')
      expect(formatted).toContain('💡 Suggestion: This is a test suggestion')
      expect(formatted).toContain('🔄 Alternative: This is an alternative approach')
      expect(formatted).toContain('📊 Impact: This is the impact')
      expect(formatted).toContain('📖 Documentation: https://docs.example.com/test')
    })

    it('should format a minimal warning', () => {
      const warning: TranslationWarning = {
        category: 'compatibility_issue',
        severity: 'info',
        message: 'Minimal warning',
        explanation: 'Minimal explanation',
      }

      const formatted = TranslationWarningSystem.formatWarning(warning)

      expect(formatted).toContain('ℹ️ INFO: Minimal warning')
      expect(formatted).toContain('Minimal explanation')
      expect(formatted).not.toContain('💡 Suggestion:')
      expect(formatted).not.toContain('🔄 Alternative:')
      expect(formatted).not.toContain('📊 Impact:')
      expect(formatted).not.toContain('📖 Documentation:')
    })

    it('should use correct severity icons', () => {
      const criticalWarning: TranslationWarning = {
        category: 'feature_unsupported',
        severity: 'critical',
        message: 'Critical',
        explanation: 'Critical explanation',
      }

      const warningWarning: TranslationWarning = {
        category: 'lossy_conversion',
        severity: 'warning',
        message: 'Warning',
        explanation: 'Warning explanation',
      }

      const infoWarning: TranslationWarning = {
        category: 'performance_impact',
        severity: 'info',
        message: 'Info',
        explanation: 'Info explanation',
      }

      expect(TranslationWarningSystem.formatWarning(criticalWarning)).toContain('🚨 CRITICAL:')
      expect(TranslationWarningSystem.formatWarning(warningWarning)).toContain('⚠️ WARNING:')
      expect(TranslationWarningSystem.formatWarning(infoWarning)).toContain('ℹ️ INFO:')
    })
  })

  describe('groupWarningsBySeverity', () => {
    it('should group warnings by severity', () => {
      const warnings: TranslationWarning[] = [
        {
          category: 'feature_unsupported',
          severity: 'critical',
          message: 'Critical 1',
          explanation: 'Explanation 1',
        },
        {
          category: 'lossy_conversion',
          severity: 'warning',
          message: 'Warning 1',
          explanation: 'Explanation 2',
        },
        {
          category: 'performance_impact',
          severity: 'info',
          message: 'Info 1',
          explanation: 'Explanation 3',
        },
        {
          category: 'feature_unsupported',
          severity: 'critical',
          message: 'Critical 2',
          explanation: 'Explanation 4',
        },
      ]

      const grouped = TranslationWarningSystem.groupWarningsBySeverity(warnings)

      expect(grouped.critical).toHaveLength(2)
      expect(grouped.warning).toHaveLength(1)
      expect(grouped.info).toHaveLength(1)
      expect(grouped.critical[0]?.message).toBe('Critical 1')
      expect(grouped.critical[1]?.message).toBe('Critical 2')
      expect(grouped.warning[0]?.message).toBe('Warning 1')
      expect(grouped.info[0]?.message).toBe('Info 1')
    })
  })

  describe('getWarningSummary', () => {
    it('should provide a comprehensive warning summary', () => {
      const warnings: TranslationWarning[] = [
        {
          category: 'feature_unsupported',
          severity: 'critical',
          message: 'Critical 1',
          explanation: 'Explanation 1',
        },
        {
          category: 'feature_unsupported',
          severity: 'critical',
          message: 'Critical 2',
          explanation: 'Explanation 2',
        },
        {
          category: 'lossy_conversion',
          severity: 'warning',
          message: 'Warning 1',
          explanation: 'Explanation 3',
        },
        {
          category: 'performance_impact',
          severity: 'info',
          message: 'Info 1',
          explanation: 'Explanation 4',
        },
        {
          category: 'performance_impact',
          severity: 'info',
          message: 'Info 2',
          explanation: 'Explanation 5',
        },
      ]

      const summary = TranslationWarningSystem.getWarningSummary(warnings)

      expect(summary).toEqual({
        total: 5,
        bySeverity: {
          critical: 2,
          warning: 1,
          info: 2,
        },
        byCategory: {
          feature_unsupported: 2,
          lossy_conversion: 1,
          syntax_limitation: 0,
          performance_impact: 2,
          security_consideration: 0,
          compatibility_issue: 0,
        },
        hasBlockingIssues: true,
      })
    })

    it('should indicate no blocking issues when no critical warnings', () => {
      const warnings: TranslationWarning[] = [
        {
          category: 'performance_impact',
          severity: 'info',
          message: 'Info warning',
          explanation: 'Info explanation',
        },
      ]

      const summary = TranslationWarningSystem.getWarningSummary(warnings)

      expect(summary.hasBlockingIssues).toBe(false)
      expect(summary.bySeverity.critical).toBe(0)
    })
  })
})