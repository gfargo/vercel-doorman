# Cloudflare WAF Integration Roadmap

> Comprehensive implementation plan for adding Cloudflare WAF support to Vercel Doorman

**Project Goal:** Transform Vercel Doorman into a multi-provider firewall management CLI tool supporting both Vercel Firewall and Cloudflare WAF.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Analysis](#current-state-analysis)
3. [Target Architecture](#target-architecture)
4. [Implementation Phases](#implementation-phases)
5. [File Structure](#file-structure)
6. [Testing Strategy](#testing-strategy)
7. [Documentation Updates](#documentation-updates)
8. [Migration Strategy](#migration-strategy)
9. [Timeline & Resources](#timeline--resources)
10. [Success Metrics](#success-metrics)
11. [Risks & Mitigation](#risks--mitigation)

---

## Executive Summary

### Vision

Enable developers to manage firewall rules across multiple providers (Vercel and Cloudflare) using a unified CLI tool with Infrastructure as Code principles.

### Key Benefits

- **Unified Interface:** Single tool for managing multiple firewall providers
- **Provider Flexibility:** Easy switching between Vercel and Cloudflare
- **Cross-Provider Migration:** Import rules from one provider and export to another
- **Best Practices:** Provider-specific health checks and recommendations
- **Developer Experience:** Maintain existing Vercel workflows while adding Cloudflare support

### Scope

**In Scope:**

- Cloudflare WAF custom rules support
- Multi-provider configuration management
- Rule translation between providers
- All existing Vercel Doorman commands adapted for Cloudflare
- Comprehensive documentation and examples
- Migration tooling for existing users

**Out of Scope (v2.0):**

- Cloudflare managed rulesets (future enhancement)
- Cloudflare Page Rules integration
- Cloudflare Transform Rules
- Multi-provider simultaneous sync
- Web UI/dashboard

### High-Level Approach

1. **Refactor** existing codebase to support provider abstraction
2. **Implement** Cloudflare API client and service layer
3. **Add** rule translation logic between Vercel and Cloudflare formats
4. **Update** all CLI commands to support provider selection
5. **Document** thoroughly with examples and migration guides
6. **Test** extensively with integration and unit tests
7. **Release** as v2.0.0 with backward compatibility

---

## Current State Analysis

### Existing Architecture

**Core Components:**

```
src/
├── commands/           # CLI command handlers
├── lib/
│   ├── services/
│   │   ├── VercelClient.ts       # Vercel API client
│   │   ├── FirewallService.ts    # Rule sync/diff logic
│   │   └── ValidationService.ts  # Config validation
│   ├── schemas/
│   │   └── firewallSchemas.ts   # Zod schemas
│   ├── templates/      # Rule templates
│   ├── types.ts        # TypeScript types
│   └── utils/          # Utility functions
└── next/              # Next.js integration
```

**Key Files & Their Roles:**

| File                 | Purpose                | Lines     | Complexity |
| -------------------- | ---------------------- | --------- | ---------- |
| `VercelClient.ts`    | Vercel API HTTP client | 286       | Medium     |
| `FirewallService.ts` | Rule diffing & sync    | 376       | High       |
| `types.ts`           | Type definitions       | 122       | Low        |
| `firewallSchemas.ts` | Zod validation         | 199       | Medium     |
| `commands/*.ts`      | CLI command handlers   | ~200 each | Medium     |

**Strengths:**

- ✅ Well-structured service layer
- ✅ Comprehensive type system
- ✅ Strong validation with Zod schemas
- ✅ Good separation of concerns
- ✅ Robust error handling

**Limitations:**

- ⚠️ Tightly coupled to Vercel API structure
- ⚠️ No provider abstraction
- ⚠️ Single config format (Vercel-specific)
- ⚠️ No rule translation capability

### Current Features

**Commands:**

- `list` - Display firewall rules
- `sync` - Push local config to Vercel
- `download` - Import rules from Vercel
- `template` - Add rule templates
- `validate` - Check config validity
- `status` - Show sync status and health
- `diff` - Show detailed differences
- `watch` - Auto-sync on file changes
- `backup` - Create/restore backups
- `export` - Export in multiple formats
- `init` - Initialize configuration
- `setup` - Show setup guide

**Features:**

- Bidirectional sync with Vercel
- Custom rules and IP blocking
- Rule templates (AI bots, bad bots, OFAC countries, WordPress)
- Configuration health scoring
- Multiple export formats (JSON, YAML, Markdown, Terraform)
- Watch mode for development
- Backup/restore functionality

---

## Target Architecture

### Provider Abstraction Design

```
┌─────────────────────────────────────────────────────┐
│                 CLI Commands Layer                   │
│  (list, sync, download, validate, status, etc.)     │
└─────────────────┬───────────────────────────────────┘
                  │
┌─────────────────▼───────────────────────────────────┐
│            Provider Selection Layer                  │
│       (Detects/selects Vercel or Cloudflare)        │
└─────────────────┬───────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼─────────┐
│ Vercel Provider│  │Cloudflare Prov │
│   Implementation│  │ Implementation │
└───────┬────────┘  └──────┬─────────┘
        │                   │
        │   ┌───────────────▼────────┐
        │   │  Rule Translator       │
        │   │  (Vercel ↔ Cloudflare) │
        │   └───────────────┬────────┘
        │                   │
┌───────▼───────────────────▼────────┐
│      Common Service Layer           │
│  (Diffing, validation, health)     │
└─────────────────────────────────────┘
```

### Provider Interface

```typescript
interface IFirewallProvider {
  // Core operations
  fetchConfig(version?: number): Promise<ProviderConfig>
  syncRules(config: UnifiedConfig, options?: SyncOptions): Promise<SyncResult>
  validateConfig(config: UnifiedConfig): ValidationResult
  getChanges(config: UnifiedConfig): Promise<ChangeSet>

  // Provider info
  getProviderName(): string
  getSupportedFeatures(): FeatureSet

  // Rule operations
  createRule(rule: UnifiedRule): Promise<ProviderRule>
  updateRule(rule: UnifiedRule): Promise<ProviderRule>
  deleteRule(ruleId: string): Promise<void>

  // IP blocking
  createIPRule?(rule: IPBlockingRule): Promise<ProviderIPRule>
  updateIPRule?(rule: IPBlockingRule): Promise<ProviderIPRule>
  deleteIPRule?(ruleId: string): Promise<void>
}
```

### Unified Configuration Format

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "version": "2.0",
  "provider": "cloudflare",

  "providers": {
    "vercel": {
      "projectId": "prj_abc123",
      "teamId": "team_xyz789"
    },
    "cloudflare": {
      "zoneId": "zone_abc123",
      "accountId": "acc_xyz789"
    }
  },

  "rules": [
    {
      "id": "rule_block_bots",
      "name": "Block Bad Bots",
      "description": "Block malicious bots and crawlers",
      "active": true,
      "conditions": [
        {
          "field": "user_agent",
          "operator": "contains",
          "value": "bot"
        }
      ],
      "action": "block"
    }
  ],

  "ips": [
    {
      "ip": "192.168.1.100",
      "hostname": "suspicious-host",
      "action": "deny",
      "notes": "Blocked due to abuse"
    }
  ],

  "metadata": {
    "version": 5,
    "updatedAt": "2025-01-15T10:00:00Z"
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation & Architecture (Week 1-2)

#### 1.1 Provider Abstraction Layer

**Tasks:**

- [ ] Create `src/lib/providers/` directory structure
- [ ] Define `IFirewallProvider` interface
- [ ] Create `BaseFirewallClient` abstract class
- [ ] Create `BaseFirewallService` abstract class
- [ ] Implement `ProviderRegistry` for provider management
- [ ] Add provider detection logic

**Files to Create:**

```
src/lib/providers/
├── index.ts
├── IFirewallProvider.ts
├── BaseFirewallClient.ts
├── BaseFirewallService.ts
├── ProviderRegistry.ts
└── ProviderDetector.ts
```

**Implementation Details:**

`IFirewallProvider.ts`:

```typescript
export interface IFirewallProvider {
  readonly name: 'vercel' | 'cloudflare'

  fetchConfig(version?: number): Promise<UnifiedConfig>
  syncRules(config: UnifiedConfig, options?: SyncOptions): Promise<SyncResult>
  validateConfig(config: UnifiedConfig): ValidationResult
  getChanges(config: UnifiedConfig): Promise<ChangeSet>

  getSupportedFeatures(): FeatureSet
  getHealthScore(config: UnifiedConfig): HealthScore
}
```

#### 1.2 Type System Refactoring

**Tasks:**

- [ ] Create `src/lib/types/common.ts` for shared types
- [ ] Create `src/lib/types/vercel.ts` for Vercel-specific types
- [ ] Create `src/lib/types/cloudflare.ts` for Cloudflare-specific types
- [ ] Create `src/lib/types/unified.ts` for provider-agnostic types
- [ ] Refactor existing `types.ts` to use new structure
- [ ] Add union types for provider-specific features

**New Type Hierarchy:**

```typescript
// common.ts - Shared across all providers
export type ActionType = 'log' | 'deny' | 'challenge' | 'allow' | 'rate_limit'
export type Operator = 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'matches' | 'in'

// unified.ts - Provider-agnostic format
export interface UnifiedRule {
  id?: string
  name: string
  description?: string
  enabled: boolean
  conditions: UnifiedCondition[]
  action: UnifiedAction
}

export interface UnifiedCondition {
  field: string
  operator: Operator
  value: string | string[] | number
  negated?: boolean
}

// vercel.ts - Vercel-specific
export interface VercelRule extends CustomRule {
  // Existing Vercel types
}

// cloudflare.ts - Cloudflare-specific
export interface CloudflareRule {
  id: string
  action: CloudflareAction
  expression: string
  enabled: boolean
  description?: string
}
```

#### 1.3 Configuration Schema Updates

**Tasks:**

- [ ] Create `src/lib/schemas/commonSchemas.ts`
- [ ] Create `src/lib/schemas/cloudflareSchemas.ts`
- [ ] Update `src/lib/schemas/firewallSchemas.ts` for unified config
- [ ] Add schema versioning support
- [ ] Create schema migration utilities

**Deliverables:**

- Provider interface definitions
- Refactored type system
- Updated Zod schemas
- Unit tests for type guards and validation

---

### Phase 2: Cloudflare Implementation (Week 2-3)

#### 2.1 Cloudflare API Client

**Tasks:**

- [ ] Create `src/lib/services/CloudflareClient.ts`
- [ ] Implement authentication with API tokens
- [ ] Implement all Ruleset Engine API endpoints
- [ ] Add rate limit handling with exponential backoff
- [ ] Add comprehensive error handling
- [ ] Add request/response logging

**API Methods to Implement:**

```typescript
class CloudflareClient extends BaseFirewallClient {
  // Ruleset operations
  async listRulesets(): Promise<CloudflareRuleset[]>
  async getRuleset(rulesetId: string): Promise<CloudflareRuleset>
  async createRuleset(ruleset: CreateRulesetRequest): Promise<CloudflareRuleset>
  async updateRuleset(rulesetId: string, ruleset: UpdateRulesetRequest): Promise<CloudflareRuleset>
  async deleteRuleset(rulesetId: string): Promise<void>

  // Rule operations
  async createRule(rulesetId: string, rule: CreateRuleRequest): Promise<CloudflareRule>
  async updateRule(rulesetId: string, ruleId: string, rule: UpdateRuleRequest): Promise<CloudflareRule>
  async deleteRule(rulesetId: string, ruleId: string): Promise<void>

  // Helper methods
  private async makeRequest<T>(url: string, options: RequestInit): Promise<T>
  private handleRateLimit(response: Response): Promise<void>
  private getHeaders(): HeadersInit
}
```

**File:** `src/lib/services/CloudflareClient.ts` (~400 lines)

#### 2.2 Cloudflare Service Layer

**Tasks:**

- [ ] Create `src/lib/services/CloudflareFirewallService.ts`
- [ ] Implement `IFirewallProvider` interface
- [ ] Implement rule diffing logic
- [ ] Implement sync operations
- [ ] Add IP blocking rule handling (via custom rules)
- [ ] Add ruleset version management

**Key Methods:**

```typescript
class CloudflareFirewallService implements IFirewallProvider {
  constructor(private client: CloudflareClient)

  async fetchConfig(version?: number): Promise<UnifiedConfig>
  async syncRules(config: UnifiedConfig, options?: SyncOptions): Promise<SyncResult>
  async getChanges(config: UnifiedConfig): Promise<ChangeSet>

  // Cloudflare-specific
  private async findOrCreateFirewallRuleset(): Promise<string>
  private async convertToCloudflareRules(rules: UnifiedRule[]): Promise<CloudflareRule[]>
  private async convertFromCloudflareRules(rules: CloudflareRule[]): Promise<UnifiedRule[]>
}
```

**File:** `src/lib/services/CloudflareFirewallService.ts` (~500 lines)

#### 2.3 Rule Translation Layer

**Tasks:**

- [ ] Create `src/lib/translators/RuleTranslator.ts`
- [ ] Implement Vercel → Cloudflare translation
- [ ] Implement Cloudflare → Vercel translation
- [ ] Add expression builder for wirefilter syntax
- [ ] Create feature compatibility matrix
- [ ] Handle untranslatable features gracefully

**Translation Logic:**

```typescript
class RuleTranslator {
  // Vercel to Cloudflare
  static vercelToCloudflare(rule: VercelRule): CloudflareRule {
    return {
      id: rule.id,
      action: this.translateAction(rule.action),
      expression: this.buildExpression(rule.conditionGroup),
      enabled: rule.active,
      description: rule.description,
    }
  }

  // Build wirefilter expression from Vercel conditions
  private static buildExpression(conditionGroups: ConditionGroup[]): string {
    // OR between groups, AND within groups
    const groupExpressions = conditionGroups.map((group) => {
      const conditions = group.conditions.map((c) => this.translateCondition(c))
      return `(${conditions.join(' and ')})`
    })
    return groupExpressions.join(' or ')
  }

  // Translate single condition
  private static translateCondition(condition: RuleCondition): string {
    const field = this.mapFieldName(condition.type)
    const operator = this.mapOperator(condition.op)
    const value = this.formatValue(condition.value)

    let expr = `${field} ${operator} ${value}`
    if (condition.neg) {
      expr = `not (${expr})`
    }
    return expr
  }

  // Cloudflare to Vercel
  static cloudflareToVercel(rule: CloudflareRule): VercelRule {
    // Parse wirefilter expression back to structured format
    const conditionGroups = this.parseExpression(rule.expression)
    return {
      id: rule.id,
      name: rule.description || `Rule ${rule.id}`,
      action: this.translateActionToVercel(rule.action),
      conditionGroup: conditionGroups,
      active: rule.enabled,
    }
  }
}
```

**Files to Create:**

```
src/lib/translators/
├── index.ts
├── RuleTranslator.ts
├── ExpressionBuilder.ts
├── ExpressionParser.ts
└── FieldMapper.ts
```

**Deliverables:**

- Cloudflare API client with full CRUD operations
- Cloudflare service layer implementing provider interface
- Bidirectional rule translation
- Unit tests with >80% coverage
- Integration tests with mocked API responses

---

### Phase 3: Vercel Refactoring (Week 3-4)

#### 3.1 Refactor Existing Vercel Code

**Tasks:**

- [ ] Move `VercelClient.ts` to `src/lib/providers/vercel/`
- [ ] Create `VercelFirewallService.ts` implementing `IFirewallProvider`
- [ ] Extract common logic to `BaseFirewallService`
- [ ] Update imports across codebase
- [ ] Ensure backward compatibility
- [ ] Add provider-specific health checks

**File Reorganization:**

```
Before:
src/lib/services/
├── VercelClient.ts
├── FirewallService.ts
└── ValidationService.ts

After:
src/lib/providers/
├── vercel/
│   ├── VercelClient.ts
│   ├── VercelFirewallService.ts
│   └── VercelProvider.ts
├── cloudflare/
│   ├── CloudflareClient.ts
│   ├── CloudflareFirewallService.ts
│   └── CloudflareProvider.ts
└── common/
    ├── BaseFirewallClient.ts
    ├── BaseFirewallService.ts
    └── ProviderRegistry.ts
```

#### 3.2 Extract Common Service Logic

**Tasks:**

- [ ] Create `BaseFirewallService` with shared diffing logic
- [ ] Move common validation to shared service
- [ ] Extract retry logic to utility
- [ ] Standardize error handling
- [ ] Create provider-agnostic interfaces

**Common Logic to Extract:**

```typescript
abstract class BaseFirewallService {
  // Common diffing logic
  protected diffRules<T>(
    localRules: T[],
    remoteRules: T[],
    compareFn: (a: T, b: T) => boolean,
  ): { toAdd: T[]; toUpdate: T[]; toDelete: T[] }

  // Common validation
  protected validateRuleCount(count: number, limit: number): void

  // Common metadata handling
  protected updateMetadata(config: UnifiedConfig, version: number): UnifiedConfig
}
```

**Deliverables:**

- Refactored Vercel implementation using provider interface
- Extracted common logic to base classes
- Zero breaking changes for existing functionality
- Updated unit tests

---

### Phase 4: Command Layer Updates (Week 4-5)

#### 4.1 Update All Commands for Multi-Provider Support

**Commands to Update:**

##### `sync` Command

**Changes:**

- Add `--provider` flag
- Auto-detect provider from config
- Use appropriate provider implementation
- Update output messages for clarity

**Updated Usage:**

```bash
vercel-doorman sync                           # Auto-detect provider
vercel-doorman sync --provider vercel         # Force Vercel
vercel-doorman sync --provider cloudflare     # Force Cloudflare
```

**Implementation:**

```typescript
// src/commands/sync.ts
export const builder = {
  // ... existing options
  provider: {
    type: 'string',
    description: 'Firewall provider (vercel or cloudflare)',
    choices: ['vercel', 'cloudflare'],
  },
}

export const handler = async (argv: Arguments<SyncOptions>) => {
  const config = await getConfig(argv.config)
  const providerName = argv.provider || config.provider || detectProvider(config)
  const provider = ProviderRegistry.get(providerName)

  // Rest of sync logic using provider
  await provider.syncRules(config, options)
}
```

##### `download` Command

**Changes:**

- Support downloading from either provider
- Handle provider-specific metadata
- Translate rules to unified format

##### `list` Command

**Changes:**

- Display provider name in output
- Show provider-specific information
- Update table formatting for clarity

##### `status` Command

**Changes:**

- Display provider type
- Show provider-specific health metrics
- Add provider feature compatibility info

##### `diff` Command

**Changes:**

- Support cross-provider diffs
- Show translation warnings
- Highlight incompatible features

##### `validate` Command

**Changes:**

- Provider-specific validation
- Check feature compatibility
- Warn about unsupported features

##### `template` Command

**Changes:**

- Mark template compatibility per provider
- Auto-translate templates to target provider
- Show provider-specific template variations

##### `export` Command

**Changes:**

- Add `--target-provider` option
- Export to Vercel or Cloudflare format
- Include translation notes

##### `backup` and `watch` Commands

**Changes:**

- Provider-aware backups
- Support both providers in watch mode

##### `init` and `setup` Commands

**Changes:**

- Add provider selection
- Provider-specific setup instructions
- Generate appropriate config structure

#### 4.2 Provider Selection & Detection

**Tasks:**

- [ ] Create `ProviderDetector` utility
- [ ] Implement config-based detection
- [ ] Implement credential-based detection
- [ ] Add interactive provider selection
- [ ] Handle ambiguous cases gracefully

**Detection Logic:**

```typescript
class ProviderDetector {
  static detect(config: Partial<UnifiedConfig>, credentials: Credentials): ProviderType {
    // 1. Explicit provider in config
    if (config.provider) return config.provider

    // 2. Provider-specific config present
    if (config.providers?.cloudflare?.zoneId) return 'cloudflare'
    if (config.providers?.vercel?.projectId) return 'vercel'

    // 3. Check environment variables
    if (process.env.CLOUDFLARE_ZONE_ID) return 'cloudflare'
    if (process.env.VERCEL_PROJECT_ID) return 'vercel'

    // 4. Prompt user
    return await this.promptForProvider()
  }
}
```

**Deliverables:**

- All 12 commands updated for multi-provider support
- Provider detection and selection logic
- Updated command documentation
- Integration tests for each command with both providers

---

### Phase 5: Configuration & Credentials (Week 5)

#### 5.1 Configuration Management

**Tasks:**

- [ ] Update config file discovery logic
- [ ] Support multiple config file names
- [ ] Implement config migration utilities
- [ ] Add config validation for multi-provider
- [ ] Create config templates for each provider

**Config File Names:**

```
Priority order:
1. --config flag value
2. vercel-firewall.config.json (legacy, Vercel)
3. cloudflare-firewall.config.json (Cloudflare)
4. firewall.config.json (unified)
5. doorman.config.json (new unified name)
```

**Migration Utility:**

```bash
# Migrate existing Vercel config to unified format
vercel-doorman migrate --from vercel --to unified

# Convert Vercel config to Cloudflare format
vercel-doorman migrate --from vercel --to cloudflare

# Preview migration without writing
vercel-doorman migrate --from vercel --to cloudflare --dry-run
```

#### 5.2 Credential Management

**Tasks:**

- [ ] Update `promptForCredentials.ts`
- [ ] Add Cloudflare credential prompts
- [ ] Implement credential validation
- [ ] Add token scope verification
- [ ] Update environment variable handling

**Environment Variables:**

```bash
# Cloudflare
CLOUDFLARE_API_TOKEN="your_token"
CLOUDFLARE_ZONE_ID="your_zone_id"
CLOUDFLARE_ACCOUNT_ID="your_account_id"  # Optional

# Vercel (existing)
VERCEL_TOKEN="your_token"
VERCEL_PROJECT_ID="prj_xxx"
VERCEL_TEAM_ID="team_xxx"

# Provider selection
DOORMAN_PROVIDER="cloudflare"  # or "vercel"
```

**Updated Credential Prompt:**

```typescript
// src/lib/ui/promptForCredentials.ts
export async function promptForCredentials(
  provider: ProviderType,
  options: CredentialOptions,
): Promise<ProviderCredentials> {
  switch (provider) {
    case 'vercel':
      return promptForVercelCredentials(options)
    case 'cloudflare':
      return promptForCloudflareCredentials(options)
  }
}

async function promptForCloudflareCredentials(options: CredentialOptions) {
  const token = options.token || process.env.CLOUDFLARE_API_TOKEN || (await prompt('Cloudflare API Token:'))
  const zoneId = options.zoneId || process.env.CLOUDFLARE_ZONE_ID || (await prompt('Zone ID:'))
  const accountId = options.accountId || process.env.CLOUDFLARE_ACCOUNT_ID

  // Validate token
  await validateCloudflareToken(token, zoneId)

  return { token, zoneId, accountId }
}
```

**Deliverables:**

- Updated configuration management
- Multi-provider credential handling
- Config migration utilities
- Environment variable documentation

---

### Phase 6: Templates & Examples (Week 5-6)

#### 6.1 Update Existing Templates

**Tasks:**

- [ ] Audit existing templates for provider compatibility
- [ ] Add Cloudflare expression equivalents
- [ ] Update template metadata with provider info
- [ ] Create provider-specific template variations
- [ ] Test templates with both providers

**Template Structure Update:**

```typescript
// src/lib/templates/types.ts
export interface Template {
  metadata: {
    name: string
    description: string
    category: string
    providers: ProviderType[] // NEW: which providers support this
    compatibility: {
      vercel: CompatibilityLevel
      cloudflare: CompatibilityLevel
    }
  }
  config: {
    vercel?: VercelRuleConfig // NEW: Vercel-specific
    cloudflare?: CloudflareRuleConfig // NEW: Cloudflare-specific
    unified: UnifiedRuleConfig // Provider-agnostic format
  }
}
```

**Templates to Update:**

1. `ai-bots.ts` - Block AI crawlers
2. `bad-bots.ts` - Block malicious bots
3. `block-ofac-sanctioned-countries.ts` - Geo-blocking
4. `wordpress.ts` - WordPress protection

#### 6.2 Create Cloudflare-Specific Templates

**New Templates:**

- [ ] `cloudflare-bot-fight-mode.ts` - Cloudflare bot detection
- [ ] `cloudflare-rate-limiting.ts` - Advanced rate limiting
- [ ] `cloudflare-ddos-protection.ts` - DDoS mitigation
- [ ] `cloudflare-api-protection.ts` - API endpoint protection
- [ ] `cloudflare-malicious-uploads.ts` - File upload security

**Example Template:**

```typescript
// src/lib/templates/rules/cloudflare-bot-fight-mode.ts
export const cloudflareBotFightMode: Template = {
  metadata: {
    name: 'Cloudflare Bot Fight Mode',
    description: 'Use Cloudflare bot score to challenge suspicious traffic',
    category: 'security',
    providers: ['cloudflare'],
    compatibility: {
      vercel: 'not-supported',
      cloudflare: 'full',
    },
  },
  config: {
    cloudflare: {
      rules: [
        {
          action: 'managed_challenge',
          expression: 'cf.bot_management.score lt 30',
          description: 'Challenge low bot score traffic',
          enabled: true,
        },
      ],
    },
  },
}
```

#### 6.3 Create Example Configurations

**Tasks:**

- [ ] Create Cloudflare example configs
- [ ] Create multi-provider examples
- [ ] Create migration examples
- [ ] Update existing Vercel examples

**New Example Files:**

```
examples/
├── vercel/
│   ├── simple-config.json
│   ├── rate-limiting.json
│   └── ... (existing examples)
├── cloudflare/
│   ├── simple-config.json
│   ├── bot-protection.json
│   ├── rate-limiting.json
│   ├── geo-blocking.json
│   └── api-security.json
└── unified/
    ├── multi-provider.json
    └── migrated-config.json
```

**Deliverables:**

- Updated templates with provider metadata
- 5+ new Cloudflare-specific templates
- 10+ example configurations for both providers
- Template documentation

---

### Phase 7: Testing (Week 6-7)

#### 7.1 Unit Tests

**Test Coverage Goals:**

- Overall: >80%
- Core services: >90%
- Rule translator: >95%

**Tests to Create:**

**Cloudflare Client Tests:**

```typescript
describe('CloudflareClient', () => {
  describe('listRulesets', () => {
    it('should fetch all rulesets for a zone')
    it('should handle empty ruleset list')
    it('should handle API errors gracefully')
    it('should retry on rate limit (429)')
  })

  describe('createRuleset', () => {
    it('should create a new custom ruleset')
    it('should validate ruleset structure')
    it('should handle duplicate names')
  })

  // ... more tests
})
```

**Rule Translator Tests:**

```typescript
describe('RuleTranslator', () => {
  describe('vercelToCloudflare', () => {
    it('should translate simple path rule')
    it('should translate IP blocking rule')
    it('should translate complex nested conditions')
    it('should handle rate limit rules')
    it('should warn on unsupported features')
  })

  describe('cloudflareToVercel', () => {
    it('should parse simple expression')
    it('should parse complex OR/AND expressions')
    it('should handle IP range expressions')
    it('should round-trip correctly')
  })

  describe('buildExpression', () => {
    it('should create AND expressions from single group')
    it('should create OR expressions from multiple groups')
    it('should handle negation correctly')
    it('should escape special characters')
  })
})
```

**Provider Service Tests:**

```typescript
describe('CloudflareFirewallService', () => {
  describe('syncRules', () => {
    it('should sync new rules')
    it('should update modified rules')
    it('should delete removed rules')
    it('should handle sync failures gracefully')
  })

  describe('getChanges', () => {
    it('should detect added rules')
    it('should detect modified rules')
    it('should detect deleted rules')
    it('should compare rules correctly')
  })
})
```

#### 7.2 Integration Tests

**Test Scenarios:**

**Provider Switching:**

```typescript
describe('Provider Switching Integration', () => {
  it('should export from Vercel and import to Cloudflare')
  it('should handle feature incompatibilities')
  it('should preserve rule intent across providers')
})
```

**Command Integration:**

```typescript
describe('Command Integration', () => {
  describe('sync command', () => {
    it('should sync to Vercel when provider is vercel')
    it('should sync to Cloudflare when provider is cloudflare')
    it('should auto-detect provider from config')
  })

  describe('download command', () => {
    it('should download from Vercel')
    it('should download from Cloudflare')
    it('should translate rules to unified format')
  })
})
```

#### 7.3 Test Infrastructure

**Tasks:**

- [ ] Set up mock API responses
- [ ] Create test fixtures for both providers
- [ ] Add test helpers for rule creation
- [ ] Set up CI/CD test pipeline
- [ ] Add snapshot testing for rule translation

**Test Fixtures:**

```
src/tests/fixtures/
├── vercel/
│   ├── configs/
│   ├── api-responses/
│   └── rules/
├── cloudflare/
│   ├── configs/
│   ├── api-responses/
│   └── rulesets/
└── unified/
    └── configs/
```

**Deliverables:**

- > 80% overall test coverage
- Unit tests for all new code
- Integration tests for provider switching
- Mocked API tests for both providers
- CI/CD pipeline with automated testing

---

### Phase 8: Documentation (Week 7-8)

#### 8.1 README Updates

**Tasks:**

- [ ] Update main README with multi-provider info
- [ ] Add provider comparison section
- [ ] Update quick start for both providers
- [ ] Add Cloudflare setup instructions
- [ ] Update feature list
- [ ] Add migration guide overview

**New README Sections:**

```markdown
## Supported Providers

Vercel Doorman now supports multiple firewall providers:

| Provider            | Status          | Features                                   |
| ------------------- | --------------- | ------------------------------------------ |
| **Vercel Firewall** | ✅ Full Support | Custom rules, IP blocking, rate limiting   |
| **Cloudflare WAF**  | ✅ Full Support | Custom rules, rate limiting, managed rules |

## Quick Start

### Vercel Firewall

\`\`\`bash
vercel-doorman init --provider vercel
vercel-doorman sync
\`\`\`

### Cloudflare WAF

\`\`\`bash
vercel-doorman init --provider cloudflare
vercel-doorman sync
\`\`\`

## Provider Migration

Migrate your rules between providers:

\`\`\`bash
vercel-doorman migrate --from vercel --to cloudflare
\`\`\`
```

#### 8.2 New Documentation Files

**Files to Create:**

##### `CLOUDFLARE_SETUP.md`

- Complete Cloudflare setup guide
- API token creation steps
- Zone ID location
- Credential management
- Common troubleshooting

##### `PROVIDER_COMPARISON.md`

- Feature comparison table
- Supported rule types
- Action mapping
- Limitations per provider
- When to use which provider

##### `MIGRATION_GUIDE.md`

- Vercel → Cloudflare migration
- Cloudflare → Vercel migration
- Rule translation details
- Feature compatibility
- Migration CLI command usage
- Rollback procedures

##### `RULE_TRANSLATION.md`

- Translation reference
- Condition mapping table
- Operator equivalents
- Expression examples
- Unsupported features
- Translation best practices

##### `API_REFERENCE.md`

- Provider interface documentation
- Rule translator API
- Configuration structure
- TypeScript types
- Usage examples

#### 8.3 Update Existing Docs

**Tasks:**

- [ ] Update `CLAUDE.md` with new structure
- [ ] Update commands overview
- [ ] Update architecture diagrams
- [ ] Update troubleshooting guide
- [ ] Add Cloudflare error codes

#### 8.4 Code Documentation

**Tasks:**

- [ ] Add JSDoc comments to all public APIs
- [ ] Document provider interfaces
- [ ] Add inline code examples
- [ ] Create type documentation
- [ ] Generate API docs (TypeDoc)

**Deliverables:**

- Updated README
- 5+ new comprehensive documentation files
- Updated existing documentation
- JSDoc comments on all public APIs
- Generated API documentation

---

### Phase 9: Release Preparation (Week 8)

#### 9.1 Version Planning

**Release Version:** `v2.0.0` (Major version)

**Breaking Changes:**

- Configuration structure changes (backward compatible with migration)
- File structure reorganization (internal, no user impact)
- Minimum Node.js version: 18+ (if needed)

**Backward Compatibility Strategy:**

- Support v1.x config format with auto-migration prompt
- Keep existing Vercel functionality unchanged
- Add deprecation warnings for old patterns

#### 9.2 Migration Utilities

**Tasks:**

- [ ] Create `migrate` command
- [ ] Implement config auto-migration
- [ ] Add migration validation
- [ ] Create rollback mechanism
- [ ] Add migration dry-run mode

**Migration Command:**

```bash
# Migrate config format
vercel-doorman migrate --from vercel --to unified
vercel-doorman migrate --from unified --to cloudflare

# Migrate rules between providers
vercel-doorman migrate --from vercel --to cloudflare --rules

# Preview migration
vercel-doorman migrate --from vercel --to cloudflare --dry-run

# With backup
vercel-doorman migrate --from vercel --to cloudflare --backup
```

#### 9.3 Changelog & Release Notes

**Tasks:**

- [ ] Write comprehensive CHANGELOG.md
- [ ] Create release notes
- [ ] Highlight breaking changes
- [ ] Document migration steps
- [ ] List new features

**CHANGELOG Template:**

```markdown
# Changelog

## [2.0.0] - 2025-XX-XX

### 🎉 Major Features

- **Multi-Provider Support**: Added Cloudflare WAF support alongside Vercel Firewall
- **Rule Translation**: Bidirectional rule translation between providers
- **Unified Configuration**: New configuration format supporting multiple providers
- **Migration Tools**: CLI commands to migrate between providers

### ✨ New Features

- Cloudflare WAF integration with full CRUD operations
- `migrate` command for provider switching
- Provider-specific templates (5+ new Cloudflare templates)
- Cross-provider rule translation
- Enhanced health checking per provider

### 🔄 Changed

- Configuration structure now supports multiple providers
- File organization refactored for better modularity
- Updated all CLI commands to support provider selection

### ⚠️ Breaking Changes

- Configuration format updated (v1 configs auto-migrate)
- Minimum Node.js version: 18.x

### 🐛 Bug Fixes

- (List any bugs fixed during refactor)

### 📚 Documentation

- New CLOUDFLARE_SETUP.md guide
- New PROVIDER_COMPARISON.md
- New MIGRATION_GUIDE.md
- Updated README with multi-provider examples

### 🧪 Testing

- Added 200+ new tests for Cloudflare integration
- Integration tests for provider switching
- > 80% code coverage maintained
```

#### 9.4 Package & Dependencies

**Tasks:**

- [ ] Update `package.json`
- [ ] Review and update dependencies
- [ ] Add Cloudflare-related keywords
- [ ] Update repository description
- [ ] Configure semantic-release for v2

**package.json Updates:**

```json
{
  "name": "vercel-doorman",
  "version": "2.0.0",
  "description": "Manage Vercel Firewall and Cloudflare WAF rules in code",
  "keywords": ["vercel", "cloudflare", "firewall", "waf", "IaC", "security", "multi-provider"]
}
```

#### 9.5 Pre-Release Checklist

**Testing:**

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing of each command
- [ ] Test migration from v1 to v2
- [ ] Test both providers end-to-end
- [ ] Performance testing (sync large rulesets)

**Documentation:**

- [ ] All documentation reviewed and updated
- [ ] Examples tested and verified
- [ ] API documentation generated
- [ ] Migration guide validated

**Code Quality:**

- [ ] No TypeScript errors
- [ ] Linting passes
- [ ] Code formatting consistent
- [ ] No security vulnerabilities (npm audit)

**Release:**

- [ ] CHANGELOG.md complete
- [ ] GitHub release notes drafted
- [ ] npm package ready
- [ ] Git tags created

**Deliverables:**

- v2.0.0 release package
- Migration utilities
- Comprehensive changelog
- Release announcement

---

## File Structure

### Current Structure

```
vercel-doorman/
├── src/
│   ├── commands/           # CLI commands
│   ├── constants/          # Constants
│   ├── lib/
│   │   ├── services/       # Service layer
│   │   ├── schemas/        # Zod schemas
│   │   ├── templates/      # Rule templates
│   │   ├── ui/            # UI components
│   │   ├── utils/         # Utilities
│   │   ├── logger.ts
│   │   └── types.ts
│   ├── next/              # Next.js integration
│   └── index.ts
├── examples/              # Example configs
├── schema/               # JSON schema
├── bin/                  # CLI entry
└── tests/                # Tests
```

### Target Structure (v2.0)

```
vercel-doorman/
├── src/
│   ├── commands/                    # CLI commands (updated)
│   │   ├── backup.ts
│   │   ├── diff.ts
│   │   ├── download.ts
│   │   ├── export.ts
│   │   ├── init.ts
│   │   ├── list.ts
│   │   ├── migrate.ts              # NEW: Migration command
│   │   ├── setup.ts
│   │   ├── status.ts
│   │   ├── sync.ts
│   │   ├── template.ts
│   │   ├── validate.ts
│   │   ├── watch.ts
│   │   └── index.ts
│   ├── constants/
│   ├── lib/
│   │   ├── providers/              # NEW: Provider abstraction
│   │   │   ├── common/
│   │   │   │   ├── BaseFirewallClient.ts
│   │   │   │   ├── BaseFirewallService.ts
│   │   │   │   └── ProviderRegistry.ts
│   │   │   ├── vercel/
│   │   │   │   ├── VercelClient.ts
│   │   │   │   ├── VercelFirewallService.ts
│   │   │   │   └── VercelProvider.ts
│   │   │   ├── cloudflare/        # NEW: Cloudflare implementation
│   │   │   │   ├── CloudflareClient.ts
│   │   │   │   ├── CloudflareFirewallService.ts
│   │   │   │   └── CloudflareProvider.ts
│   │   │   ├── IFirewallProvider.ts
│   │   │   ├── ProviderDetector.ts
│   │   │   └── index.ts
│   │   ├── translators/           # NEW: Rule translation
│   │   │   ├── RuleTranslator.ts
│   │   │   ├── ExpressionBuilder.ts
│   │   │   ├── ExpressionParser.ts
│   │   │   ├── FieldMapper.ts
│   │   │   └── index.ts
│   │   ├── services/              # Shared services
│   │   │   └── ValidationService.ts
│   │   ├── schemas/               # Schemas (updated)
│   │   │   ├── commonSchemas.ts
│   │   │   ├── vercelSchemas.ts
│   │   │   ├── cloudflareSchemas.ts  # NEW
│   │   │   ├── unifiedSchemas.ts     # NEW
│   │   │   └── index.ts
│   │   ├── templates/             # Templates (updated)
│   │   │   ├── rules/
│   │   │   │   ├── ai-bots.ts
│   │   │   │   ├── bad-bots.ts
│   │   │   │   ├── block-ofac-sanctioned-countries.ts
│   │   │   │   ├── wordpress.ts
│   │   │   │   ├── cloudflare-bot-fight-mode.ts  # NEW
│   │   │   │   ├── cloudflare-rate-limiting.ts   # NEW
│   │   │   │   └── ...
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   ├── types/                 # NEW: Reorganized types
│   │   │   ├── common.ts
│   │   │   ├── vercel.ts
│   │   │   ├── cloudflare.ts     # NEW
│   │   │   ├── unified.ts        # NEW
│   │   │   └── index.ts
│   │   ├── ui/                    # UI components (updated)
│   │   ├── utils/                 # Utilities (updated)
│   │   │   ├── config.ts
│   │   │   ├── configFinder.ts
│   │   │   ├── configHealth.ts
│   │   │   ├── migration.ts      # NEW
│   │   │   └── ...
│   │   └── logger.ts
│   ├── next/                      # Next.js integration
│   └── index.ts
├── examples/                      # Examples (reorganized)
│   ├── vercel/
│   │   ├── simple-config.json
│   │   ├── rate-limiting.json
│   │   └── ...
│   ├── cloudflare/               # NEW
│   │   ├── simple-config.json
│   │   ├── bot-protection.json
│   │   └── ...
│   └── unified/                  # NEW
│       └── multi-provider.json
├── docs/                         # NEW: Documentation
│   ├── CLOUDFLARE_SETUP.md
│   ├── PROVIDER_COMPARISON.md
│   ├── MIGRATION_GUIDE.md
│   ├── RULE_TRANSLATION.md
│   └── API_REFERENCE.md
├── schema/                       # JSON schemas (updated)
├── bin/                          # CLI entry
├── tests/                        # Tests (expanded)
│   ├── fixtures/
│   │   ├── vercel/
│   │   ├── cloudflare/          # NEW
│   │   └── unified/             # NEW
│   ├── unit/
│   │   ├── providers/           # NEW
│   │   └── translators/         # NEW
│   └── integration/
├── README.md                     # Updated
├── CHANGELOG.md                  # Updated
├── CLOUDFLARE_WAF_REFERENCE.md  # NEW: Technical reference
└── CLOUDFLARE_INTEGRATION_ROADMAP.md  # This document
```

### New Files Summary

**Total New Files:** ~40

**By Category:**

- Providers: ~10 files
- Translators: ~5 files
- Types: ~5 files
- Schemas: ~3 files
- Templates: ~5 files
- Commands: ~1 file (migrate)
- Documentation: ~6 files
- Tests: ~30+ new test files
- Examples: ~10 files

---

## Testing Strategy

### Test Pyramid

```
        /\
       /  \    E2E Tests (10%)
      /────\   - End-to-end provider workflows
     /      \  - Real API testing (optional)
    /────────\
   / Integ.   \ Integration Tests (20%)
  /  Tests     \ - Provider switching
 /──────────────\ - Command integration
/   Unit Tests   \ Unit Tests (70%)
\________________/ - Provider services
                  - Rule translation
                  - Utilities
```

### Coverage Goals

| Component          | Target Coverage | Priority |
| ------------------ | --------------- | -------- |
| Rule Translator    | 95%             | Critical |
| Cloudflare Service | 90%             | Critical |
| Cloudflare Client  | 85%             | High     |
| Vercel Service     | 90%             | High     |
| Commands           | 80%             | Medium   |
| Utilities          | 85%             | Medium   |
| **Overall**        | **80%**         | -        |

### Test Types

#### 1. Unit Tests

**Focus:** Individual functions and methods

**Examples:**

- `RuleTranslator.vercelToCloudflare()`
- `ExpressionBuilder.buildExpression()`
- `FieldMapper.mapFieldName()`
- `CloudflareClient.createRuleset()`

**Tools:** Jest, mocked dependencies

#### 2. Integration Tests

**Focus:** Component interaction

**Examples:**

- Sync command with Cloudflare provider
- Download command with rule translation
- Provider switching workflow
- Config migration

**Tools:** Jest, mocked APIs

#### 3. E2E Tests (Optional)

**Focus:** Full user workflows

**Examples:**

- Complete sync workflow (local → remote)
- Download → modify → sync cycle
- Provider migration with real APIs

**Tools:** Jest, real API tokens (CI secrets)

### Mock Strategy

**Cloudflare API Mocks:**

```typescript
// tests/mocks/cloudflare-api.ts
export const mockCloudflareAPI = {
  listRulesets: jest.fn(() =>
    Promise.resolve({
      success: true,
      result: [
        /* ... */
      ],
    }),
  ),
  createRuleset: jest.fn(() =>
    Promise.resolve({
      success: true,
      result: {
        /* ... */
      },
    }),
  ),
  // ... more mocks
}
```

**Test Fixtures:**

```typescript
// tests/fixtures/cloudflare/rulesets.ts
export const sampleRuleset: CloudflareRuleset = {
  id: 'test-ruleset-id',
  name: 'Test Ruleset',
  kind: 'custom',
  phase: 'http_request_firewall_custom',
  rules: [
    /* ... */
  ],
}
```

---

## Documentation Updates

### Documentation Hierarchy

```
Documentation
├── User Documentation
│   ├── README.md (overview, quick start)
│   ├── CLOUDFLARE_SETUP.md (Cloudflare onboarding)
│   ├── MIGRATION_GUIDE.md (provider migration)
│   └── TROUBLESHOOTING.md (common issues)
├── Reference Documentation
│   ├── CLOUDFLARE_WAF_REFERENCE.md (technical details)
│   ├── PROVIDER_COMPARISON.md (feature comparison)
│   ├── RULE_TRANSLATION.md (translation reference)
│   └── API_REFERENCE.md (API documentation)
├── Developer Documentation
│   ├── CLAUDE.md (development guidelines)
│   ├── CONTRIBUTING.md (contribution guide)
│   └── ARCHITECTURE.md (system architecture)
└── Examples
    ├── examples/vercel/
    ├── examples/cloudflare/
    └── examples/unified/
```

### Documentation Standards

**All documentation should include:**

1. Table of contents (for docs >500 lines)
2. Code examples with syntax highlighting
3. Command-line examples
4. Screenshots where helpful
5. Links to related documentation
6. "Last Updated" date

**Writing Style:**

- Clear and concise
- Active voice
- Step-by-step instructions
- Real-world examples
- Troubleshooting sections

---

## Migration Strategy

### For Existing Users (v1 → v2)

#### Automatic Migration

When users run any command with a v1 config:

```bash
$ vercel-doorman sync

⚠️  Detected v1 configuration format.
Would you like to migrate to v2? (y/n): y

✓ Backed up existing config to vercel-firewall.config.v1.backup.json
✓ Migrated configuration to unified format
✓ Config saved to firewall.config.json

Your rules and settings have been preserved.
You can now use all v2 features including multi-provider support!
```

#### Manual Migration

```bash
# Preview migration
vercel-doorman migrate --dry-run

# Migrate with backup
vercel-doorman migrate --backup

# Migrate to specific format
vercel-doorman migrate --to unified
```

### Config Migration Logic

**v1 Config:**

```json
{
  "projectId": "prj_abc",
  "teamId": "team_xyz",
  "rules": [...],
  "ips": [...]
}
```

**v2 Config (Migrated):**

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "version": "2.0",
  "provider": "vercel",
  "providers": {
    "vercel": {
      "projectId": "prj_abc",
      "teamId": "team_xyz"
    }
  },
  "rules": [...],
  "ips": [...],
  "metadata": {
    "version": 1,
    "migratedFrom": "1.5.7",
    "migratedAt": "2025-01-15T10:00:00Z"
  }
}
```

### Breaking Changes & Mitigation

| Breaking Change   | Impact                      | Mitigation                |
| ----------------- | --------------------------- | ------------------------- |
| Config structure  | Existing configs won't load | Auto-migration prompt     |
| File organization | Internal only               | No user impact            |
| Min Node.js 18+   | Users on <18 can't upgrade  | Document in release notes |
| API changes       | None (internal only)        | N/A                       |

### Communication Plan

**Announcement Channels:**

1. GitHub Release Notes
2. npm package update
3. README.md banner (temporary)
4. Twitter/Social media (if applicable)

**Key Messages:**

1. Exciting new multi-provider support
2. Full backward compatibility with auto-migration
3. Easy upgrade path
4. New Cloudflare WAF support
5. No breaking changes for Vercel users

---

## Timeline & Resources

### Phase Timeline

| Phase                        | Duration      | Key Deliverables                | Dependencies |
| ---------------------------- | ------------- | ------------------------------- | ------------ |
| **Phase 1:** Foundation      | 2 weeks       | Provider abstraction, types     | -            |
| **Phase 2:** Cloudflare Impl | 1.5 weeks     | API client, service, translator | Phase 1      |
| **Phase 3:** Vercel Refactor | 1 week        | Refactored Vercel code          | Phase 1, 2   |
| **Phase 4:** Commands        | 1.5 weeks     | Updated commands                | Phase 3      |
| **Phase 5:** Config/Creds    | 0.5 weeks     | Config management               | Phase 4      |
| **Phase 6:** Templates       | 1 week        | Updated/new templates           | Phase 4      |
| **Phase 7:** Testing         | 1.5 weeks     | Comprehensive tests             | All above    |
| **Phase 8:** Documentation   | 1 week        | All documentation               | All above    |
| **Phase 9:** Release         | 0.5 weeks     | Release prep                    | All above    |
| **Total**                    | **~10 weeks** | v2.0.0 Release                  | -            |

### Resource Requirements

**Development:**

- 1 Full-time developer (10 weeks)
- Part-time code review (ongoing)

**Testing:**

- QA testing (1 week, Phase 7)
- Beta testing (optional, 1 week before release)

**Documentation:**

- Technical writer (optional, Phase 8)
- Reviewer (ongoing)

### Milestones

| Milestone                   | Target Date | Description                 |
| --------------------------- | ----------- | --------------------------- |
| **M1:** Foundation Complete | Week 2      | Provider abstraction ready  |
| **M2:** Cloudflare Working  | Week 4      | Basic Cloudflare sync works |
| **M3:** Feature Complete    | Week 6      | All commands updated        |
| **M4:** Testing Complete    | Week 8      | >80% coverage achieved      |
| **M5:** Docs Complete       | Week 9      | All docs written/reviewed   |
| **M6:** v2.0.0 Release      | Week 10     | Public release              |

### Critical Path

```
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 7 → Phase 9
```

**Why Critical:**

- Phase 1: Foundation for all other work
- Phase 2: Core Cloudflare functionality
- Phase 3: Vercel refactoring blocks commands
- Phase 4: Commands needed for testing
- Phase 7: Testing gates release
- Phase 9: Release preparation

---

## Success Metrics

### Technical Metrics

| Metric                   | Target                | Measurement                      |
| ------------------------ | --------------------- | -------------------------------- |
| **Test Coverage**        | >80%                  | Jest coverage report             |
| **Type Safety**          | 100%                  | TypeScript strict mode, 0 errors |
| **Performance**          | <2s sync for 50 rules | Benchmark tests                  |
| **Translation Accuracy** | >95%                  | Round-trip tests                 |
| **API Error Rate**       | <1%                   | Error tracking                   |

### User Experience Metrics

| Metric                            | Target               | Measurement    |
| --------------------------------- | -------------------- | -------------- |
| **Migration Success Rate**        | >99%                 | Error tracking |
| **Time to First Sync (new user)** | <5 min               | User testing   |
| **Documentation Clarity**         | >4/5 rating          | User survey    |
| **GitHub Issues (bugs)**          | <10 in first month   | Issue tracker  |
| **Adoption Rate**                 | >50% within 3 months | npm downloads  |

### Feature Metrics

| Feature                    | Target        | Status     |
| -------------------------- | ------------- | ---------- |
| **Cloudflare WAF Support** | Full CRUD     | ⏳ Pending |
| **Rule Translation**       | Bidirectional | ⏳ Pending |
| **Provider Switching**     | Seamless      | ⏳ Pending |
| **Config Migration**       | Automatic     | ⏳ Pending |
| **Template Library**       | 10+ templates | ⏳ Pending |

### Quality Gates

**Phase Completion Criteria:**

**Phase 1-6:**

- [ ] All code written and reviewed
- [ ] Unit tests >80% coverage
- [ ] TypeScript compiles with no errors
- [ ] Linting passes
- [ ] Manual smoke tests pass

**Phase 7:**

- [ ] Overall coverage >80%
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] No critical bugs
- [ ] Performance tests pass

**Phase 8:**

- [ ] All docs written
- [ ] Docs reviewed for accuracy
- [ ] Examples tested
- [ ] Migration guide validated

**Phase 9 (Release):**

- [ ] All quality gates passed
- [ ] CHANGELOG complete
- [ ] Release notes written
- [ ] Package version updated
- [ ] GitHub release created
- [ ] npm package published

---

## Risks & Mitigation

### Technical Risks

| Risk                            | Probability | Impact | Mitigation                               |
| ------------------------------- | ----------- | ------ | ---------------------------------------- |
| **Rule translation complexity** | Medium      | High   | Comprehensive test suite, phased rollout |
| **API rate limits**             | Low         | Medium | Implement robust retry logic, caching    |
| **Expression parser issues**    | Medium      | High   | Extensive testing, fallback to manual    |
| **Performance degradation**     | Low         | Medium | Benchmark tests, optimization pass       |
| **Breaking changes in deps**    | Low         | Low    | Lock dependency versions                 |

### Project Risks

| Risk                        | Probability | Impact | Mitigation                              |
| --------------------------- | ----------- | ------ | --------------------------------------- |
| **Scope creep**             | Medium      | High   | Strict scope definition, defer features |
| **Timeline overrun**        | Medium      | Medium | Buffer time, prioritize core features   |
| **Resource unavailability** | Low         | High   | Clear documentation, modular design     |
| **Community pushback**      | Low         | Medium | Communication plan, backward compat     |

### Security Risks

| Risk                           | Probability | Impact   | Mitigation                          |
| ------------------------------ | ----------- | -------- | ----------------------------------- |
| **Credential exposure**        | Low         | Critical | Env var best practices, docs        |
| **Token privilege escalation** | Low         | High     | Scope validation, permission checks |
| **Malicious rule injection**   | Low         | High     | Input validation, sanitization      |
| **Dependency vulnerabilities** | Medium      | Medium   | Regular `npm audit`, updates        |

### Mitigation Strategies

**For Translation Complexity:**

1. Build comprehensive test suite early (Phase 2)
2. Create translation validation tool
3. Provide manual override options
4. Document known limitations
5. Add translation confidence scores

**For Scope Creep:**

1. Define v2.0 scope clearly (this document)
2. Defer non-essential features to v2.1+
3. Track "nice-to-haves" in backlog
4. Regular scope review meetings

**For Timeline Overrun:**

1. Build 10% buffer into each phase
2. Identify critical path items
3. Prioritize core functionality
4. Be willing to defer non-critical items

**For Community Pushback:**

1. Clear communication about benefits
2. Easy migration path
3. Maintain backward compatibility
4. Gather feedback early (beta testing)
5. Provide rollback options

---

## Post-Release Roadmap (v2.1+)

### Future Enhancements

**v2.1 - Enhanced Cloudflare Support (Q2 2025)**

- Managed ruleset integration
- Page Rules support
- Transform Rules integration
- Bulk Redirects support
- Cloudflare Workers integration

**v2.2 - Advanced Features (Q3 2025)**

- Multi-provider simultaneous sync
- Rule conflict detection across providers
- Advanced rule analytics
- Cost optimization recommendations
- Terraform provider integration

**v2.3 - Enterprise Features (Q4 2025)**

- Role-based access control (RBAC)
- Audit logging
- Compliance reporting
- Multi-environment support
- Team collaboration features

**v3.0 - Additional Providers (2026)**

- AWS WAF support
- Fastly WAF support
- Azure Front Door support
- Provider-agnostic rule DSL

---

## Appendices

### A. Glossary

| Term                | Definition                                       |
| ------------------- | ------------------------------------------------ |
| **Provider**        | Firewall service (Vercel or Cloudflare)          |
| **Ruleset**         | Collection of firewall rules (Cloudflare)        |
| **Expression**      | Wirefilter syntax rule (Cloudflare)              |
| **Condition Group** | Grouped conditions (Vercel)                      |
| **Unified Config**  | Provider-agnostic configuration format           |
| **Translation**     | Converting rules between provider formats        |
| **Phase**           | Execution stage in request pipeline (Cloudflare) |

### B. Reference Links

**Cloudflare Documentation:**

- [WAF Overview](https://developers.cloudflare.com/waf/)
- [Ruleset Engine](https://developers.cloudflare.com/ruleset-engine/)
- [API Reference](https://developers.cloudflare.com/api/)
- [Rules Language](https://developers.cloudflare.com/ruleset-engine/rules-language/)

**Vercel Documentation:**

- [Firewall Docs](https://vercel.com/docs/security/vercel-firewall)
- [API Reference](https://vercel.com/docs/rest-api/endpoints/firewall)

**Internal Documentation:**

- [CLOUDFLARE_WAF_REFERENCE.md](./CLOUDFLARE_WAF_REFERENCE.md)
- [CLAUDE.md](./CLAUDE.md)

### C. Command Reference

**All Commands with Provider Support:**

```bash
# Setup & Initialization
vercel-doorman setup [--provider <vercel|cloudflare>]
vercel-doorman init [--provider <vercel|cloudflare>] [--interactive]

# Status & Information
vercel-doorman status [--provider <vercel|cloudflare>]
vercel-doorman list [--provider <vercel|cloudflare>]
vercel-doorman diff [--provider <vercel|cloudflare>]

# Configuration Management
vercel-doorman sync [--provider <vercel|cloudflare>]
vercel-doorman download [--provider <vercel|cloudflare>] [configVersion]
vercel-doorman validate [--provider <vercel|cloudflare>]

# Advanced Features
vercel-doorman watch [--provider <vercel|cloudflare>]
vercel-doorman backup [--provider <vercel|cloudflare>]
vercel-doorman export [--format <json|yaml|markdown|terraform>] [--provider <vercel|cloudflare>]
vercel-doorman template [templateName] [--provider <vercel|cloudflare>]

# Migration (NEW)
vercel-doorman migrate [--from <vercel|cloudflare>] [--to <vercel|cloudflare|unified>]
```

### D. Environment Variables

**Complete List:**

```bash
# Provider Selection
DOORMAN_PROVIDER=vercel|cloudflare

# Cloudflare
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_ACCOUNT_ID=your_account_id

# Vercel
VERCEL_TOKEN=your_token
VERCEL_PROJECT_ID=prj_xxx
VERCEL_TEAM_ID=team_xxx

# General
DOORMAN_CONFIG_PATH=/path/to/config.json
DOORMAN_DEBUG=true|false
DOORMAN_LOG_LEVEL=debug|info|warn|error
```

---

## Document History

| Version | Date       | Changes         | Author           |
| ------- | ---------- | --------------- | ---------------- |
| 1.0     | 2025-01-15 | Initial roadmap | Development Team |

---

**Next Steps:**

1. ✅ Review and approve this roadmap
2. ⏳ Begin Phase 1 implementation
3. ⏳ Set up project tracking (GitHub Projects)
4. ⏳ Schedule weekly progress reviews
5. ⏳ Create Phase 1 detailed task breakdown

---

**Questions or Feedback?**

- GitHub Issues: [gfargo/vercel-doorman/issues](https://github.com/gfargo/vercel-doorman/issues)
- Email: ghfargo@gmail.com

---

**Document Maintained By:** Vercel Doorman Development Team
**Last Updated:** 2025-01-15
