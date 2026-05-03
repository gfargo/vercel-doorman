#!/usr/bin/env node

/**
 * Demo script showing the enhanced translation warning system
 * Run with: npx ts-node examples/translation-warnings-demo.ts
 */

import { RuleTranslator, TranslationWarningSystem } from '../src/lib/translators'
import type { VercelCustomRule } from '../src/lib/types/vercel'

console.log('🔄 Enhanced Translation Warning System Demo\n')

// Example 1: Complex rule with multiple warnings
console.log('📋 Example 1: Complex Vercel rule with multiple conditions')
const complexRule: VercelCustomRule = {
  id: 'demo-complex-rule',
  name: 'Complex Demo Rule',
  description: 'A rule with many conditions and regex patterns',
  conditionGroup: [
    {
      conditions: [
        { op: 'eq', type: 'host', value: 'example.com' },
        { op: 'pre', type: 'path', value: '/api/' },
        { op: 're', type: 'user_agent', value: '.*bot.*' }, // Regex warning
        { op: 'eq', type: 'method', value: 'POST' },
        { op: 'inc', type: 'geo_country', value: ['US', 'CA', 'GB'] },
        { op: 'eq', type: 'scheme', value: 'https' },
        { op: 'ex', type: 'header', key: 'authorization' },
        { op: 'sub', type: 'query', key: 'debug', value: 'true' },
        { op: 'eq', type: 'cookie', key: 'session', value: 'active' },
        { op: 'eq', type: 'ip_address', value: '192.168.1.1' },
        { op: 're', type: 'header', key: 'accept', value: 'application/json.*' }, // Another regex warning
      ],
    },
  ],
  action: {
    mitigate: {
      action: 'rate_limit',
      rateLimit: {
        requests: 100,
        window: '1h',
        characteristics: ['ip.src'],
        // No mitigationTimeout to trigger warning
      },
    },
  },
  active: true,
}

const result = RuleTranslator.vercelToUnified(complexRule)

console.log(`Generated ${result.warnings.length} warnings:`)
result.warnings.forEach((warning, index) => {
  console.log(`\n${index + 1}. ${TranslationWarningSystem.formatWarning(warning)}`)
})

// Example 2: Warning summary
console.log('\n' + '='.repeat(80))
console.log('📊 Example 2: Warning Summary')

const warnings = [
  TranslationWarningSystem.createWarning('managed_rules'),
  TranslationWarningSystem.createWarning('bot_management'),
  TranslationWarningSystem.createWarning('complex_expressions'),
  TranslationWarningSystem.createWarning('rate_limiting_precision'),
  TranslationWarningSystem.createWarning('large_ip_lists'),
]

const summary = TranslationWarningSystem.getWarningSummary(warnings)

console.log(`\nTotal warnings: ${summary.total}`)
console.log(`Critical: ${summary.bySeverity.critical}`)
console.log(`Warning: ${summary.bySeverity.warning}`)
console.log(`Info: ${summary.bySeverity.info}`)
console.log(`Has blocking issues: ${summary.hasBlockingIssues}`)

console.log('\nBy category:')
Object.entries(summary.byCategory).forEach(([category, count]) => {
  if (count > 0) {
    console.log(`  ${category}: ${count}`)
  }
})

// Example 3: Grouped warnings
console.log('\n' + '='.repeat(80))
console.log('📂 Example 3: Warnings Grouped by Severity')

const grouped = TranslationWarningSystem.groupWarningsBySeverity(warnings)

if (grouped.critical.length > 0) {
  console.log('\n🚨 CRITICAL WARNINGS:')
  grouped.critical.forEach((warning, index) => {
    console.log(`${index + 1}. ${warning.message}`)
    console.log(`   ${warning.explanation}`)
  })
}

if (grouped.warning.length > 0) {
  console.log('\n⚠️ WARNINGS:')
  grouped.warning.forEach((warning, index) => {
    console.log(`${index + 1}. ${warning.message}`)
    console.log(`   ${warning.explanation}`)
  })
}

if (grouped.info.length > 0) {
  console.log('\nℹ️ INFO:')
  grouped.info.forEach((warning, index) => {
    console.log(`${index + 1}. ${warning.message}`)
    console.log(`   ${warning.explanation}`)
  })
}

console.log('\n✅ Demo completed! The enhanced translation warning system provides:')
console.log('   • Detailed explanations of translation issues')
console.log('   • Severity levels (critical, warning, info)')
console.log('   • Actionable suggestions and alternative approaches')
console.log('   • Impact descriptions and documentation links')
console.log('   • Warning summaries and grouping capabilities')