/**
 * Schema exports
 * Validation schemas for all configuration types
 */

// Common schemas
export {
  idSchema,
  ipAddressSchema,
  timestampSchema,
  actionTypeSchema,
  operatorSchema,
  fieldTypeSchema,
  durationSchema,
  rateLimitSchema,
  redirectSchema,
  configMetadataSchema,
  providerTypeSchema,
  providersConfigSchema,
  baseConfigSchema,
} from './commonSchemas'

// Vercel schemas (from firewallSchemas.ts)
export {
  configVersionSchema,
  ruleOperatorSchema,
  ruleTypeSchema,
  ruleConditionSchema,
  conditionGroupSchema,
  ruleDurationSchema,
  mitigationActionSchema,
  ruleActionSchema,
  firewallRuleSchema,
  ipBlockingRuleSchema,
  projectConfigSchema,
  firewallConfigSchema,
} from './firewallSchemas'

// Cloudflare schemas
export {
  cloudflareRulesetKindSchema,
  cloudflareRulesetPhaseSchema,
  cloudflareActionSchema,
  cloudflareExpressionSchema,
  cloudflareBlockActionParametersSchema,
  cloudflareRedirectActionParametersSchema,
  cloudflareSkipActionParametersSchema,
  cloudflareRateLimitSchema,
  cloudflareRuleSchema,
  cloudflareRulesetSchema,
  cloudflareZoneConfigSchema,
  cloudflareFirewallConfigSchema,
  cloudflareCreateRulesetRequestSchema,
  cloudflareUpdateRulesetRequestSchema,
  cloudflareAPIResponseSchema,
} from './cloudflareSchemas'

// Unified schemas
export {
  unifiedConditionSchema,
  unifiedActionSchema,
  unifiedRuleSchema,
  unifiedIPRuleSchema,
  unifiedConfigSchema,
  validateUnifiedConfig,
} from './unifiedSchemas'

// Schema versioning
export {
  CURRENT_SCHEMA_VERSION,
  LEGACY_SCHEMA_VERSION,
  detectSchemaVersion,
  needsMigration,
  migrateV1ToV2,
  autoMigrate,
  isCompatibleVersion,
} from './schemaVersion'
