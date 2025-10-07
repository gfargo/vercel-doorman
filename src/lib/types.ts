/**
 * Legacy type exports for backward compatibility
 * All types have been moved to src/lib/types/* for better organization
 * This file re-exports them to maintain backward compatibility
 */

// Re-export all Vercel types for backward compatibility
export type {
  ActionType,
  RuleOperator,
  RuleType,
  RuleCondition,
  ConditionGroup,
  RateLimit,
  Redirect,
  MitigationAction,
  RuleAction,
  CustomRule,
  IPBlockingRule,
  ProjectConfig,
  FirewallConfig,
} from './types/vercel'

// Re-export common types
export type { Operator, FieldType, ConfigMetadata, Credentials } from './types/common'

// Re-export unified types for new features
export type { UnifiedConfig, UnifiedRule, UnifiedCondition, UnifiedAction, UnifiedIPRule } from './types/unified'

// Re-export Cloudflare types
export type { CloudflareFirewallConfig, CloudflareRule, CloudflareRuleset, CloudflareAction } from './types/cloudflare'
