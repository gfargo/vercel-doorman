import { z } from 'zod'
import type {
  CustomRule as CustomRuleType,
  FirewallConfig as FirewallConfigType,
  IPBlockingRule as IPBlockingRuleType,
  ProjectConfig as ProjectConfigType,
  RuleAction as RuleActionType,
  RuleActionType as RuleActionTypeEnum,
  RuleRateLimit as RuleRateLimitType,
  RuleRedirect as RuleRedirectType,
} from '../types/configTypes'
import type {
  RuleOperator as RuleOperatorType,
  RuleType as RuleTypeEnum,
  VercelAction as VercelActionType,
  VercelConditionGroup as VercelConditionGroupType,
  VercelCondition as VercelConditionType,
  VercelIPBlockingRule as VercelIPBlockingRuleType,
  VercelRule as VercelRuleType,
} from '../types/vercelTypes'

// Basic schemas
export const ipAddressSchema = z
  .string()
  .ip()
  .or(z.string().regex(/^(?:\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/)) // CIDR notation

export const idSchema = z.string().optional()

// Rule Types and Operators (from vercelTypes.ts)
export const ruleOperatorSchema = z.enum([
  're',
  'eq',
  'neq',
  'ex',
  'nex',
  'inc',
  'ninc',
  'pre',
  'suf',
  'sub',
  'gt',
  'gte',
  'lt',
  'lte',
]) satisfies z.ZodType<RuleOperatorType>

export const ruleTypeSchema = z.enum([
  'host',
  'path',
  'method',
  'header',
  'query',
  'cookie',
  'target_path',
  'ip_address',
  'region',
  'protocol',
  'scheme',
  'environment',
  'user_agent',
  'geo_continent',
  'geo_country',
  'geo_country_region',
  'geo_city',
  'geo_as_number',
  'ja4_digest',
  'ja3_digest',
  'rate_limit_api_id',
]) satisfies z.ZodType<RuleTypeEnum>

// Condition schemas
export const vercelConditionSchema = z.object({
  op: ruleOperatorSchema,
  type: ruleTypeSchema,
  value: z.union([z.string(), z.number(), z.array(z.string()), z.array(z.number())]),
}) satisfies z.ZodType<VercelConditionType>

export const vercelConditionGroupSchema = z.object({
  conditions: z.array(vercelConditionSchema),
}) satisfies z.ZodType<VercelConditionGroupType>

// Action schemas
export const ruleDurationSchema = z.string().regex(/^\d+[smhd]$|^permanent$/)

export const ruleRateLimitSchema = z.object({
  requests: z.number(),
  window: z.string().regex(/^\d+[smhd]$/),
}) satisfies z.ZodType<RuleRateLimitType>

export const ruleRedirectSchema = z.object({
  location: z.string(),
  permanent: z.boolean().optional(),
}) satisfies z.ZodType<RuleRedirectType>

export const ruleActionTypeSchema = z.enum([
  'allow',
  'deny',
  'challenge',
  'log',
]) satisfies z.ZodType<RuleActionTypeEnum>

export const ruleActionSchema = z.object({
  type: ruleActionTypeSchema,
  rateLimit: ruleRateLimitSchema.optional(),
  redirect: ruleRedirectSchema.optional(),
  duration: ruleDurationSchema.optional(),
}) satisfies z.ZodType<RuleActionType>

// Rule schemas
export const customRuleSchema = z.object({
  id: idSchema,
  name: z.string(),
  description: z.string().optional(),
  type: ruleTypeSchema.optional(),
  values: z.array(z.string()).optional(),
  conditionGroup: z.array(vercelConditionGroupSchema).optional(),
  action: z.union([ruleActionTypeSchema, ruleActionSchema]),
  active: z.boolean(),
}) satisfies z.ZodType<CustomRuleType>

export const ipBlockingRuleSchema = z.object({
  id: idSchema,
  ip: ipAddressSchema,
  hostname: z.string(),
  notes: z.string().optional(),
  action: z.literal('deny'),
}) satisfies z.ZodType<IPBlockingRuleType>

// Project config schema
export const projectConfigSchema = z.object({
  projectId: z.string().optional(),
  teamId: z.string().optional(),
}) satisfies z.ZodType<ProjectConfigType>

// Main firewall config schema
export const firewallConfigSchema = projectConfigSchema.extend({
  rules: z.array(customRuleSchema),
  ips: z.array(ipBlockingRuleSchema).optional(),
  version: z.number().optional(),
  updatedAt: z.string().optional(),
}) satisfies z.ZodType<FirewallConfigType>

// Vercel specific schemas
export const vercelActionSchema = z.object({
  mitigate: z.object({
    action: ruleActionTypeSchema,
    rateLimit: ruleRateLimitSchema.nullable().optional(),
    redirect: ruleRedirectSchema.nullable().optional(),
    actionDuration: ruleDurationSchema.nullable().optional(),
  }),
}) satisfies z.ZodType<VercelActionType>

export const vercelRuleSchema = z.object({
  id: idSchema,
  active: z.boolean(),
  name: z.string(),
  description: z.string().optional(),
  conditionGroup: z.array(vercelConditionGroupSchema),
  action: vercelActionSchema,
}) satisfies z.ZodType<VercelRuleType>

// Re-export types from the original type files for convenience
export type {
  CustomRuleType as CustomRule,
  FirewallConfigType as FirewallConfig,
  IPBlockingRuleType as IPBlockingRule,
  ProjectConfigType as ProjectConfig,
  RuleActionType as RuleAction,
  RuleActionTypeEnum as RuleActionType,
  RuleOperatorType as RuleOperator,
  RuleRateLimitType as RuleRateLimit,
  RuleRedirectType as RuleRedirect,
  RuleTypeEnum as RuleType,
  VercelActionType as VercelAction,
  VercelConditionType as VercelCondition,
  VercelConditionGroupType as VercelConditionGroup,
  VercelIPBlockingRuleType as VercelIPBlockingRule,
  VercelRuleType as VercelRule,
}
