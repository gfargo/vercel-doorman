import { z } from 'zod'
import type {
  CloudflareAction,
  CloudflareRule,
  CloudflareRuleset,
  CloudflareRulesetKind,
  CloudflareRulesetPhase,
  CloudflareFirewallConfig,
} from '../types/cloudflare'
import { timestampSchema } from './commonSchemas'

/**
 * Cloudflare WAF validation schemas
 */

// Cloudflare-specific enums
export const cloudflareRulesetKindSchema = z.enum([
  'root',
  'zone',
  'custom',
  'managed',
]) satisfies z.ZodType<CloudflareRulesetKind>

export const cloudflareRulesetPhaseSchema = z.enum([
  'http_request_firewall_custom',
  'http_request_firewall_managed',
  'http_ratelimit',
  'http_request_transform',
  'http_response_headers_transform',
]) satisfies z.ZodType<CloudflareRulesetPhase>

export const cloudflareActionSchema = z.enum([
  'block',
  'challenge',
  'managed_challenge',
  'js_challenge',
  'log',
  'skip',
  'allow',
  'rewrite',
  'redirect',
]) satisfies z.ZodType<CloudflareAction>

// Expression validation - basic wirefilter syntax check
export const cloudflareExpressionSchema = z
  .string()
  .min(1, 'Expression cannot be empty')
  .refine(
    (expr) => {
      // Basic validation: ensure it's not just whitespace
      return expr.trim().length > 0
    },
    {
      message: 'Expression must contain valid wirefilter syntax',
    },
  )

// Action parameters schemas
export const cloudflareBlockActionParametersSchema = z.object({
  response: z
    .object({
      status_code: z.number().int().min(100).max(599),
      content: z.string(),
      content_type: z.string(),
    })
    .optional(),
})

export const cloudflareRedirectActionParametersSchema = z.object({
  from_value: z.object({
    status_code: z.number().int().min(300).max(399),
    target_url: z.object({
      value: z.string().url(),
    }),
    preserve_query_string: z.boolean().optional(),
  }),
})

export const cloudflareSkipActionParametersSchema = z.object({
  ruleset: z.string().optional(),
  phases: z.array(z.string()).optional(),
  products: z.array(z.string()).optional(),
  rules: z.record(z.array(z.string())).optional(),
})

export const cloudflareRateLimitSchema = z.object({
  characteristics: z.array(z.string()).min(1, 'At least one characteristic is required'),
  period: z.number().int().positive(),
  requests_per_period: z.number().int().positive(),
  mitigation_timeout: z.number().int().positive().optional(),
  counting_expression: z.string().optional(),
})

// Rule schema
export const cloudflareRuleSchema = z.object({
  id: z.string(),
  version: z.string().optional(),
  action: cloudflareActionSchema,
  expression: cloudflareExpressionSchema,
  description: z.string().optional(),
  enabled: z.boolean().optional().default(true),
  categories: z.array(z.string()).optional(),
  last_updated: timestampSchema,
  ref: z.string().optional(),
  action_parameters: z
    .union([
      cloudflareBlockActionParametersSchema,
      cloudflareRedirectActionParametersSchema,
      cloudflareSkipActionParametersSchema,
    ])
    .optional(),
  ratelimit: cloudflareRateLimitSchema.optional(),
}) satisfies z.ZodType<CloudflareRule>

// Ruleset schema
export const cloudflareRulesetSchema = z.object({
  id: z.string(),
  name: z.string().min(1, 'Ruleset name is required'),
  description: z.string().optional(),
  kind: cloudflareRulesetKindSchema,
  version: z.string(),
  phase: cloudflareRulesetPhaseSchema,
  rules: z.array(cloudflareRuleSchema),
  last_updated: timestampSchema,
}) satisfies z.ZodType<CloudflareRuleset>

// Cloudflare zone config schema
export const cloudflareZoneConfigSchema = z.object({
  zoneId: z.string().min(1, 'Zone ID is required'),
  accountId: z.string().optional(),
})

// Cloudflare firewall config schema
export const cloudflareFirewallConfigSchema = cloudflareZoneConfigSchema.extend({
  $schema: z.string().url().optional(),
  version: z.string().optional(),
  rulesets: z.array(cloudflareRulesetSchema).optional(),
  rules: z.array(cloudflareRuleSchema).optional(), // Simplified format
  updatedAt: timestampSchema,
}) satisfies z.ZodType<CloudflareFirewallConfig>

// Create ruleset request schema
export const cloudflareCreateRulesetRequestSchema = z.object({
  name: z.string().min(1, 'Ruleset name is required'),
  kind: cloudflareRulesetKindSchema,
  phase: cloudflareRulesetPhaseSchema,
  description: z.string().optional(),
  rules: z
    .array(
      cloudflareRuleSchema.omit({
        id: true,
        version: true,
        last_updated: true,
      }),
    )
    .optional(),
})

// Update ruleset request schema
export const cloudflareUpdateRulesetRequestSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  rules: z.array(cloudflareRuleSchema).optional(),
})

// API response wrapper schema
export const cloudflareAPIResponseSchema = <T extends z.ZodTypeAny>(resultSchema: T) =>
  z.object({
    success: z.boolean(),
    errors: z.array(
      z.object({
        code: z.number(),
        message: z.string(),
        error_chain: z.array(z.any()).optional(),
      }),
    ),
    messages: z.array(
      z.object({
        code: z.number(),
        message: z.string(),
      }),
    ),
    result: resultSchema,
    result_info: z
      .object({
        page: z.number(),
        per_page: z.number(),
        count: z.number(),
        total_count: z.number(),
        total_pages: z.number(),
      })
      .optional(),
  })
