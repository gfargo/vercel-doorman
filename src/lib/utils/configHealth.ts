import { FirewallConfig, CustomRule } from '../types'
import chalk from 'chalk'

export interface HealthCheckResult {
  score: number // 0-100
  issues: HealthIssue[]
  recommendations: string[]
}

export interface HealthIssue {
  severity: 'error' | 'warning' | 'info'
  message: string
  rule?: string
  suggestion?: string
}

export class ConfigHealthChecker {
  static check(config: FirewallConfig): HealthCheckResult {
    const issues: HealthIssue[] = []
    const recommendations: string[] = []
    let score = 100

    // Check for common issues
    this.checkRuleNaming(config.rules, issues)
    this.checkRuleComplexity(config.rules, issues)
    this.checkSecurityBestPractices(config, issues, recommendations)
    this.checkPerformanceImpact(config, issues, recommendations)
    this.checkMaintainability(config, issues, recommendations)

    // Calculate score based on issues
    issues.forEach((issue) => {
      switch (issue.severity) {
        case 'error':
          score -= 20
          break
        case 'warning':
          score -= 10
          break
        case 'info':
          score -= 5
          break
      }
    })

    return {
      score: Math.max(0, score),
      issues,
      recommendations,
    }
  }

  private static checkRuleNaming(rules: CustomRule[], issues: HealthIssue[]) {
    rules.forEach((rule) => {
      // Check for proper snake_case ID format
      if (rule.id && !rule.id.match(/^rule_[a-z0-9_]+$/)) {
        issues.push({
          severity: 'warning',
          message: `Rule ID should follow snake_case format: rule_*`,
          rule: rule.name,
          suggestion: `Consider renaming to: rule_${rule.name.toLowerCase().replace(/\s+/g, '_')}`,
        })
      }

      // Check for descriptive names
      if (rule.name.length < 5) {
        issues.push({
          severity: 'info',
          message: 'Rule name is very short, consider making it more descriptive',
          rule: rule.name,
        })
      }

      // Check for missing descriptions
      if (!rule.description || rule.description.length < 10) {
        issues.push({
          severity: 'info',
          message: 'Rule lacks a detailed description',
          rule: rule.name,
          suggestion: 'Add a clear description explaining what this rule does and why',
        })
      }
    })
  }

  private static checkRuleComplexity(rules: CustomRule[], issues: HealthIssue[]) {
    rules.forEach((rule) => {
      const totalConditions = rule.conditionGroup.reduce((sum, group) => sum + group.conditions.length, 0)

      if (totalConditions > 10) {
        issues.push({
          severity: 'warning',
          message: 'Rule has many conditions, consider splitting into multiple rules',
          rule: rule.name,
          suggestion: 'Complex rules can be harder to maintain and debug',
        })
      }

      if (rule.conditionGroup.length > 5) {
        issues.push({
          severity: 'warning',
          message: 'Rule has many condition groups, consider simplifying',
          rule: rule.name,
        })
      }
    })
  }

  private static checkSecurityBestPractices(config: FirewallConfig, issues: HealthIssue[], recommendations: string[]) {
    const { rules, ips } = config

    // Check for rate limiting
    const hasRateLimit = rules.some((rule) => rule.action.mitigate.action === 'rate_limit')
    if (!hasRateLimit) {
      recommendations.push('Consider adding rate limiting rules for API endpoints')
    }

    // Check for bot protection
    const hasBotProtection = rules.some((rule) =>
      rule.conditionGroup.some((group) =>
        group.conditions.some(
          (condition) =>
            condition.type === 'user_agent' &&
            (condition.value?.toLowerCase().includes('bot') || condition.value?.toLowerCase().includes('crawler')),
        ),
      ),
    )
    if (!hasBotProtection) {
      recommendations.push('Consider adding bot protection rules')
    }

    // Check for overly broad rules
    rules.forEach((rule) => {
      const hasBroadPath = rule.conditionGroup.some((group) =>
        group.conditions.some((condition) => condition.type === 'path' && condition.value === '/'),
      )

      if (hasBroadPath && rule.action.mitigate.action === 'deny') {
        issues.push({
          severity: 'error',
          message: 'Rule blocks root path - this could block all traffic',
          rule: rule.name,
          suggestion: 'Be more specific with path conditions',
        })
      }
    })

    // Check IP blocking rules
    if (ips && ips.length > 100) {
      issues.push({
        severity: 'warning',
        message: 'Large number of IP blocking rules may impact performance',
        suggestion: 'Consider using CIDR ranges or external IP lists',
      })
    }
  }

  private static checkPerformanceImpact(config: FirewallConfig, issues: HealthIssue[], recommendations: string[]) {
    const { rules } = config

    // Check for regex conditions (performance impact)
    rules.forEach((rule) => {
      const hasRegex = rule.conditionGroup.some((group) => group.conditions.some((condition) => condition.op === 're'))

      if (hasRegex) {
        issues.push({
          severity: 'info',
          message: 'Rule uses regex matching, which may impact performance',
          rule: rule.name,
          suggestion: 'Consider using simpler string operations when possible',
        })
      }
    })

    // Check for too many active rules
    const activeRules = rules.filter((rule) => rule.active)
    if (activeRules.length > 50) {
      issues.push({
        severity: 'warning',
        message: 'Large number of active rules may impact performance',
        suggestion: 'Consider consolidating similar rules or disabling unused ones',
      })
    }
  }

  private static checkMaintainability(config: FirewallConfig, issues: HealthIssue[], recommendations: string[]) {
    const { rules } = config

    // Check for disabled rules
    const disabledRules = rules.filter((rule) => !rule.active)
    if (disabledRules.length > rules.length * 0.3) {
      recommendations.push('Consider removing disabled rules to reduce config complexity')
    }

    // Check for duplicate rule names
    const ruleNames = rules.map((rule) => rule.name)
    const duplicateNames = ruleNames.filter((name, index) => ruleNames.indexOf(name) !== index)

    duplicateNames.forEach((name) => {
      issues.push({
        severity: 'error',
        message: 'Duplicate rule name found',
        rule: name,
        suggestion: 'Rule names must be unique',
      })
    })

    // Check for version tracking
    if (!config.version) {
      issues.push({
        severity: 'warning',
        message: 'Configuration lacks version information',
        suggestion: 'Version tracking helps with change management',
      })
    }
  }

  static formatHealthReport(result: HealthCheckResult): string {
    let report = ''

    // Score and overall health
    const scoreColor = result.score >= 80 ? chalk.green : result.score >= 60 ? chalk.yellow : chalk.red

    report += chalk.bold(`\n🏥 Configuration Health Score: ${scoreColor(result.score)}/100\n\n`)

    // Issues
    if (result.issues.length > 0) {
      report += chalk.bold('Issues Found:\n')
      result.issues.forEach((issue, index) => {
        const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️'

        report += `${icon} ${issue.message}`
        if (issue.rule) {
          report += chalk.dim(` (${issue.rule})`)
        }
        report += '\n'

        if (issue.suggestion) {
          report += chalk.dim(`   💡 ${issue.suggestion}\n`)
        }
      })
      report += '\n'
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      report += chalk.bold('Recommendations:\n')
      result.recommendations.forEach((rec) => {
        report += `💡 ${rec}\n`
      })
    }

    return report
  }
}
