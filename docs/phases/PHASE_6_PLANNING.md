# Phase 6 Planning: Advanced Features Implementation

**Version:** 2.1.0
**Status:** Planning → Implementation
**Start Date:** 2025-10-08
**Target Completion:** 2-3 months
**Prerequisites:** ✅ Phase 5 Complete

---

## Table of Contents

1. [Overview](#overview)
2. [Migration Command Specification](#migration-command-specification)
3. [GitHub Actions Workflow Design](#github-actions-workflow-design)
4. [Expression Parser Architecture](#expression-parser-architecture)
5. [Quality Improvements](#quality-improvements)
6. [Implementation Plan](#implementation-plan)
7. [Success Criteria](#success-criteria)

---

## Overview

Phase 6 focuses on three high-priority features that enable production-ready multi-provider usage:

1. **Cross-Provider Migration** - Seamlessly migrate firewall rules between providers
2. **CI/CD Integration** - Automated deployment and validation in pipelines
3. **Advanced Rule Translation** - Improved accuracy and optimization

Plus quality improvements to enhance reliability and user experience.

---

## Current Status (Cloudflare Branch)

The Cloudflare provider is implemented and covered by tests, providing a solid foundation for Phase 6 work:

- Rulesets: list/get/create/update/delete, and `getOrCreateFirewallRuleset()`
- Rules: create/update/delete within a ruleset
- Lists API: list/get/create/update/delete lists; get/add/remove list items (requires `accountId`); falls back to individual IP rules when Lists are unavailable
- Sync & Fetch: `CloudflareFirewallService` translates unified rules to Cloudflare, fetches remote config, and diffs changes; uses `RuleTranslator` with warning surfacing
- Validation & Health: Cloudflare-specific validation and health scoring implemented (limits, redirect URL checks, rate-limit shape)
- Credentials: `verifyCredentials()` implemented and exercised in tests
- Tests: Client, service, and edge-case tests pass; multi-provider tests reference Cloudflare behavior

Known gaps to address during Phase 6:

- Translation depth: Expression parsing is simplified; warnings indicate partial coverage for complex expressions
- Migration: Command, report, backup/rollback not yet implemented
- CI integration: Actions workflow templates exist in planning, not in repo
- Confidence scoring and cost/performance estimation not implemented
- Managed rules and rate-limiting mapping are recognized but not exhaustively translated/validated

Summary: Cloudflare is “provider-ready” for basic rule/IP workflows, enabling Phase 6 focus on migration, CI, and advanced translation.

---

## Migration Command Specification

### CLI Interface

```bash
vercel-doorman migrate [options]

Options:
  --from <provider>          Source provider (vercel|cloudflare)
  --to <provider>            Target provider (vercel|cloudflare)
  --config <path>            Configuration file path
  --dry-run                  Preview migration without applying
  --backup                   Create backup before migration
  --rules <ids>              Migrate specific rules only (comma-separated)
  --report <path>            Save migration report to file
  --auto-approve             Skip confirmation prompts
  --rollback-on-error        Automatically rollback on failure

Subcommands:
  migrate analyze            Analyze migration compatibility
  migrate validate           Validate migrated rules
  migrate rollback           Rollback to previous state
```

### Migration Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     Migration Workflow                       │
└─────────────────────────────────────────────────────────────┘

1. Pre-Migration Phase
   ├── Validate credentials for both providers
   ├── Fetch current rules from source provider
   ├── Create backup of source configuration
   └── Analyze compatibility

2. Analysis Phase
   ├── Translate rules to target format
   ├── Check feature compatibility
   ├── Calculate confidence scores
   ├── Generate warnings for lossy translations
   └── Estimate performance/cost impact

3. Confirmation Phase
   ├── Display migration summary
   ├── Show compatibility warnings
   ├── List rules that can't be migrated
   └── Request user confirmation

4. Migration Phase
   ├── Translate compatible rules
   ├── Sync to target provider
   ├── Validate rules were created correctly
   └── Track migration progress

5. Post-Migration Phase
   ├── Generate detailed migration report
   ├── Update local configuration
   ├── Create rollback instructions
   └── Display summary and recommendations
```

### Migration Report Format

```typescript
interface MigrationReport {
  metadata: {
    timestamp: string
    sourceProvider: ProviderType
    targetProvider: ProviderType
    durationMs: number
  }

  summary: {
    totalRules: number
    migratedRules: number
    fullyCompatible: number
    partiallyCompatible: number
    incompatible: number
    totalIPs: number
    migratedIPs: number
  }

  compatibility: {
    warnings: CompatibilityWarning[]
    incompatibleRules: RuleIncompatibility[]
    recommendations: string[]
  }

  translation: {
    confidenceScore: number // 0-100
    translationIssues: TranslationIssue[]
    optimizations: Optimization[]
  }

  performance: {
    estimatedLatencyImpact: string
    costComparison?: CostComparison
    ruleComplexity: ComplexityAnalysis
  }

  rollback: {
    backupId: string
    rollbackCommand: string
  }
}

interface CompatibilityWarning {
  rule: string
  severity: 'warning' | 'error' | 'info'
  message: string
  suggestion: string
}

interface TranslationIssue {
  rule: string
  field: string
  issue: string
  alternativeSolutions: string[]
}
```

### File Structure

```
src/
├── commands/
│   └── migrate.ts                    # Main migration command
├── lib/
│   ├── services/
│   │   ├── MigrationService.ts       # Orchestrates migration
│   │   ├── CompatibilityChecker.ts   # Checks compatibility
│   │   └── BackupService.ts          # Handles backups
│   ├── utils/
│   │   ├── migrationReport.ts        # Report generation
│   │   └── confidenceScoring.ts      # Translation confidence
│   └── types/
│       └── migration.ts               # Migration types
```

### Implementation Phases

**Phase 6.0: Provider Readiness (Complete)**

- [x] Cloudflare client for Rulesets, Rules, and Lists
- [x] CloudflareFirewallService fetch/sync/validate with unified config
- [x] Basic translation via RuleTranslator with surfaced warnings
- [x] Credential verification and error handling paths
- [x] Unit and integration tests passing for Cloudflare

**Phase 6.1: Foundation (Week 1-2)**

- [ ] Create migration command structure
- [ ] Implement backup service
- [ ] Add migration types
- [ ] Create basic migration workflow

**Phase 6.2: Analysis (Week 3-4)**

- [ ] Implement compatibility checker
- [ ] Add confidence scoring
- [ ] Create migration report generator
- [ ] Add cost/performance estimator

**Phase 6.3: Execution (Week 5-6)**

- [ ] Implement migration execution
- [ ] Add validation post-migration
- [ ] Implement rollback functionality
- [ ] Add progress tracking

**Phase 6.4: Polish (Week 7-8)**

- [ ] Add comprehensive tests
- [ ] Improve error handling
- [ ] Write documentation
- [ ] Create example workflows

---

## GitHub Actions Workflow Design

### Example Workflow Structure

```yaml
# .github/workflows/firewall-sync.yml
name: Sync Firewall Rules

on:
  push:
    branches: [main]
    paths:
      - 'firewall.config.json'
      - '.github/workflows/firewall-sync.yml'
  pull_request:
    paths:
      - 'firewall.config.json'
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Run in dry-run mode'
        required: false
        default: 'false'

jobs:
  validate:
    name: Validate Configuration
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Vercel Doorman
        run: npm install -g vercel-doorman

      - name: Validate Configuration
        run: vercel-doorman validate --ci

      - name: Check Compatibility
        run: vercel-doorman check --ci --provider vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}

  preview:
    name: Preview Changes
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Vercel Doorman
        run: npm install -g vercel-doorman

      - name: Show Diff
        run: vercel-doorman diff --ci
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}

      - name: Comment PR
        uses: actions/github-script@v7
        with:
          script: |
            const diff = await exec.getExecOutput('vercel-doorman diff --ci --format json')
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Firewall Changes\n\n${diff.stdout}`
            })

  sync:
    name: Sync to Provider
    runs-on: ubuntu-latest
    needs: validate
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Vercel Doorman
        run: npm install -g vercel-doorman

      - name: Backup Current Config
        run: vercel-doorman backup create --ci
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}

      - name: Sync to Vercel
        id: sync
        run: vercel-doorman sync --provider vercel --ci
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}

      - name: Rollback on Failure
        if: failure()
        run: vercel-doorman backup restore --latest --ci
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
          VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}

      - name: Notify on Success
        if: success()
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.repos.createCommitStatus({
              owner: context.repo.owner,
              repo: context.repo.repo,
              sha: context.sha,
              state: 'success',
              description: 'Firewall rules synced successfully',
              context: 'vercel-doorman'
            })
```

### Official GitHub Action

**Structure:**

```
action.yml              # Action metadata
dist/                   # Compiled action code
src/
  ├── main.ts           # Action entrypoint
  ├── validate.ts       # Validation logic
  ├── sync.ts           # Sync logic
  └── utils/
      ├── inputs.ts     # Parse action inputs
      └── outputs.ts    # Set action outputs
```

**Action Definition:**

```yaml
# action.yml
name: 'Vercel Doorman'
description: 'Sync and validate firewall rules for Vercel and Cloudflare'
author: 'gfargo'

branding:
  icon: 'shield'
  color: 'blue'

inputs:
  command:
    description: 'Command to run (validate, sync, diff, status)'
    required: true
    default: 'sync'

  provider:
    description: 'Provider to use (vercel, cloudflare, all)'
    required: false

  config:
    description: 'Path to configuration file'
    required: false
    default: './firewall.config.json'

  dry-run:
    description: 'Run in dry-run mode'
    required: false
    default: 'false'

  # Vercel credentials
  vercel-token:
    description: 'Vercel API token'
    required: false

  vercel-project-id:
    description: 'Vercel project ID'
    required: false

  vercel-team-id:
    description: 'Vercel team ID'
    required: false

  # Cloudflare credentials
  cloudflare-api-token:
    description: 'Cloudflare API token'
    required: false

  cloudflare-zone-id:
    description: 'Cloudflare zone ID'
    required: false

  cloudflare-account-id:
    description: 'Cloudflare account ID'
    required: false

outputs:
  status:
    description: 'Success/failure status'

  rules-synced:
    description: 'Number of rules synced'

  changes-summary:
    description: 'Summary of changes made'

runs:
  using: 'node20'
  main: 'dist/index.js'
```

### Implementation Tasks

**Phase 6.1: Workflow Templates (Week 1)**

- [ ] Create example workflow files
- [ ] Document secrets configuration
- [ ] Add workflow for PRs
- [ ] Add workflow for production

**Phase 6.2: GitHub Action (Week 2-3)**

- [ ] Create action structure
- [ ] Implement action logic
- [ ] Add comprehensive tests
- [ ] Publish to GitHub Marketplace

**Phase 6.3: Documentation (Week 4)**

- [ ] Write setup guide
- [ ] Create troubleshooting guide
- [ ] Add example repositories
- [ ] Create video tutorial

---

## Expression Parser Architecture

### Goals

1. **Parse Cloudflare Wirefilter Expressions** → Structured conditions
2. **Generate Cloudflare Expressions** from structured conditions
3. **Optimize Expressions** for performance
4. **Validate Expressions** for correctness

### Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│                   Expression Parser                       │
└──────────────────────────────────────────────────────────┘

Input: "ip.src eq 1.2.3.4 and http.request.method eq GET"
  │
  ├─> Lexer (Tokenization)
  │     └─> [IP, DOT, SRC, EQ, IP_ADDR, AND, HTTP, ...]
  │
  ├─> Parser (AST Generation)
  │     └─> BinaryExpression {
  │           left: Comparison { field: "ip.src", op: "eq", value: "1.2.3.4" }
  │           operator: "and"
  │           right: Comparison { field: "http.request.method", op: "eq", value: "GET" }
  │         }
  │
  ├─> Validator (Semantic Analysis)
  │     └─> Check field validity, operator compatibility, value types
  │
  ├─> Optimizer (Optional)
  │     └─> Combine conditions, remove redundancies
  │
  └─> Translator
        ├─> To UnifiedCondition[]
        └─> From UnifiedCondition[] to Expression
```

### AST Structure

```typescript
// Abstract Syntax Tree for Expressions
type Expression = ComparisonExpression | LogicalExpression | UnaryExpression | GroupExpression | FunctionExpression

interface ComparisonExpression {
  type: 'comparison'
  field: FieldExpression
  operator: ComparisonOperator
  value: ValueExpression
}

interface LogicalExpression {
  type: 'logical'
  left: Expression
  operator: 'and' | 'or'
  right: Expression
}

interface UnaryExpression {
  type: 'unary'
  operator: 'not'
  operand: Expression
}

interface GroupExpression {
  type: 'group'
  expression: Expression
}

interface FunctionExpression {
  type: 'function'
  name: string
  args: Expression[]
}

interface FieldExpression {
  type: 'field'
  path: string[]
  index?: Expression // For array access like headers["X-Custom"]
}

interface ValueExpression {
  type: 'value'
  valueType: 'string' | 'number' | 'boolean' | 'ip' | 'list'
  value: string | number | boolean | string[]
}

type ComparisonOperator = 'eq' | 'ne' | 'lt' | 'le' | 'gt' | 'ge' | 'contains' | 'matches' | 'in'
```

### Lexer Design

```typescript
class ExpressionLexer {
  private input: string
  private position: number = 0
  private tokens: Token[] = []

  tokenize(input: string): Token[] {
    this.input = input
    this.position = 0
    this.tokens = []

    while (this.position < this.input.length) {
      this.skipWhitespace()

      if (this.isAtEnd()) break

      const char = this.peek()

      if (this.isIdentifierStart(char)) {
        this.readIdentifier()
      } else if (this.isDigit(char)) {
        this.readNumber()
      } else if (char === '"') {
        this.readString()
      } else if (this.isOperator(char)) {
        this.readOperator()
      } else {
        throw new Error(`Unexpected character: ${char}`)
      }
    }

    return this.tokens
  }

  private readIdentifier(): void {
    const start = this.position
    while (!this.isAtEnd() && this.isIdentifierChar(this.peek())) {
      this.advance()
    }

    const value = this.input.slice(start, this.position)
    const type = this.getKeywordType(value) || 'identifier'
    this.tokens.push({ type, value, start, end: this.position })
  }

  private getKeywordType(value: string): TokenType | null {
    const keywords: Record<string, TokenType> = {
      and: 'AND',
      or: 'OR',
      not: 'NOT',
      eq: 'EQ',
      ne: 'NE',
      lt: 'LT',
      le: 'LE',
      gt: 'GT',
      ge: 'GE',
      contains: 'CONTAINS',
      matches: 'MATCHES',
      in: 'IN',
      true: 'TRUE',
      false: 'FALSE',
    }
    return keywords[value.toLowerCase()] || null
  }
}
```

### Parser Design

```typescript
class ExpressionParser {
  private tokens: Token[]
  private current: number = 0

  parse(tokens: Token[]): Expression {
    this.tokens = tokens
    this.current = 0
    return this.parseExpression()
  }

  private parseExpression(): Expression {
    return this.parseLogicalOr()
  }

  private parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd()

    while (this.match('OR')) {
      const operator = 'or'
      const right = this.parseLogicalAnd()
      expr = { type: 'logical', left: expr, operator, right }
    }

    return expr
  }

  private parseLogicalAnd(): Expression {
    let expr = this.parseUnary()

    while (this.match('AND')) {
      const operator = 'and'
      const right = this.parseUnary()
      expr = { type: 'logical', left: expr, operator, right }
    }

    return expr
  }

  private parseUnary(): Expression {
    if (this.match('NOT')) {
      const operator = 'not'
      const operand = this.parseUnary()
      return { type: 'unary', operator, operand }
    }

    return this.parsePrimary()
  }

  private parsePrimary(): Expression {
    // Handle grouped expressions
    if (this.match('LPAREN')) {
      const expr = this.parseExpression()
      this.consume('RPAREN', 'Expected closing parenthesis')
      return { type: 'group', expression: expr }
    }

    // Handle comparison expressions
    return this.parseComparison()
  }

  private parseComparison(): ComparisonExpression {
    const field = this.parseField()
    const operator = this.parseComparisonOperator()
    const value = this.parseValue()

    return { type: 'comparison', field, operator, value }
  }
}
```

### Translator Design

```typescript
class ExpressionTranslator {
  /**
   * Translate Cloudflare expression to UnifiedCondition[]
   */
  toUnifiedConditions(expression: Expression): UnifiedCondition[] {
    const conditions: UnifiedCondition[] = []
    this.extractConditions(expression, conditions)
    return conditions
  }

  private extractConditions(expr: Expression, conditions: UnifiedCondition[]): void {
    switch (expr.type) {
      case 'comparison':
        conditions.push(this.translateComparison(expr))
        break

      case 'logical':
        this.extractConditions(expr.left, conditions)
        this.extractConditions(expr.right, conditions)
        break

      case 'unary':
        if (expr.operator === 'not') {
          const subConditions: UnifiedCondition[] = []
          this.extractConditions(expr.operand, subConditions)
          subConditions.forEach((c) => {
            c.negated = !c.negated
            conditions.push(c)
          })
        }
        break

      case 'group':
        this.extractConditions(expr.expression, conditions)
        break
    }
  }

  /**
   * Generate Cloudflare expression from UnifiedCondition[]
   */
  fromUnifiedConditions(conditions: UnifiedCondition[], logic: 'AND' | 'OR' = 'AND'): string {
    const expressions = conditions.map((c) => this.conditionToExpression(c))
    const connector = logic === 'AND' ? ' and ' : ' or '

    if (expressions.length === 0) {
      throw new Error('At least one condition required')
    }

    if (expressions.length === 1) {
      return expressions[0]
    }

    return `(${expressions.join(connector)})`
  }
}
```

### File Structure

```
src/lib/translators/
├── expression/
│   ├── Lexer.ts                 # Tokenization
│   ├── Parser.ts                # AST generation
│   ├── Validator.ts             # Semantic validation
│   ├── Optimizer.ts             # Expression optimization
│   ├── Translator.ts            # AST ↔ UnifiedCondition
│   ├── types.ts                 # AST types
│   └── __tests__/
│       ├── Lexer.test.ts
│       ├── Parser.test.ts
│       ├── Validator.test.ts
│       └── Translator.test.ts
```

### Implementation Tasks

**Phase 6.1: Foundation (Week 1-2)**

- [ ] Define AST types
- [ ] Implement lexer
- [ ] Add lexer tests
- [ ] Implement basic parser

**Phase 6.2: Parser (Week 3-4)**

- [ ] Complete parser implementation
- [ ] Add comprehensive parser tests
- [ ] Implement validator
- [ ] Add validation tests

**Phase 6.3: Translator (Week 5-6)**

- [ ] Implement AST → UnifiedCondition translator
- [ ] Implement UnifiedCondition → expression generator
- [ ] Add translation tests
- [ ] Handle edge cases

**Phase 6.4: Optimizer (Week 7-8)**

- [ ] Implement expression optimizer
- [ ] Add optimization tests
- [ ] Performance benchmarks
- [ ] Integration with RuleTranslator

---

## Quality Improvements

### 1. Cloudflare Provider Tests

**Test Coverage Goals:**

- Unit tests for CloudflareClient methods
- Integration tests for CloudflareFirewallService
- End-to-end tests for Cloudflare workflows
- Edge case and error handling tests

**Test Structure:**

```
src/lib/providers/cloudflare/__tests__/
├── CloudflareClient.test.ts
├── CloudflareFirewallService.test.ts
├── CloudflareIntegration.test.ts
└── CloudflareEdgeCases.test.ts
```

**Priority Tests:**

1. ✅ Ruleset CRUD operations
2. ✅ Lists API integration
3. ✅ Rate limiting translation
4. ✅ Expression building
5. ✅ Error handling
6. ✅ Credential validation
7. ✅ Config validation
8. ✅ Sync operations

### 2. Error Message Improvements

**Current Issues:**

- Generic error messages
- Missing actionable suggestions
- Inconsistent error formatting
- No error codes

**Improvements:**

**Before:**

```
Error: Failed to sync rules
```

**After:**

```
[SYNC_001] Failed to sync firewall rules to Cloudflare

Reason: Rate limit exceeded (429 Too Many Requests)

Suggestion: Wait 60 seconds and try again, or use --retry flag

Details:
  - API endpoint: /zones/{zoneId}/rulesets
  - Rate limit: 1200 requests per 5 minutes
  - Retry after: 60 seconds

Documentation: https://docs.doorman.griffen.codes/errors/SYNC_001
```

**Error Code Structure:**

```typescript
enum ErrorCode {
  // Configuration errors (1000-1999)
  CONFIG_INVALID = 'CONFIG_1000',
  CONFIG_NOT_FOUND = 'CONFIG_1001',
  CONFIG_PARSE_ERROR = 'CONFIG_1002',

  // Validation errors (2000-2999)
  VALIDATION_FAILED = 'VAL_2000',
  VALIDATION_SCHEMA_ERROR = 'VAL_2001',
  VALIDATION_RULE_ERROR = 'VAL_2002',

  // Sync errors (3000-3999)
  SYNC_FAILED = 'SYNC_3000',
  SYNC_RATE_LIMIT = 'SYNC_3001',
  SYNC_CONFLICT = 'SYNC_3002',

  // Migration errors (4000-4999)
  MIGRATION_FAILED = 'MIG_4000',
  MIGRATION_INCOMPATIBLE = 'MIG_4001',
  MIGRATION_ROLLBACK_FAILED = 'MIG_4002',

  // Provider errors (5000-5999)
  PROVIDER_AUTH_FAILED = 'PROV_5000',
  PROVIDER_NOT_FOUND = 'PROV_5001',
  PROVIDER_API_ERROR = 'PROV_5002',
}
```

**Implementation:**

```typescript
class DoormanError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public suggestion?: string,
    public details?: Record<string, unknown>,
    public docsUrl?: string,
  ) {
    super(message)
    this.name = 'DoormanError'
  }

  format(): string {
    const parts = [chalk.red(`[${this.code}] ${this.message}`), '']

    if (this.suggestion) {
      parts.push(chalk.yellow('Suggestion:'), `  ${this.suggestion}`, '')
    }

    if (this.details) {
      parts.push(chalk.dim('Details:'))
      Object.entries(this.details).forEach(([key, value]) => {
        parts.push(`  - ${key}: ${value}`)
      })
      parts.push('')
    }

    if (this.docsUrl) {
      parts.push(chalk.cyan('Documentation:'), `  ${this.docsUrl}`)
    }

    return parts.join('\n')
  }
}
```

### 3. Performance Optimizations

**Target Areas:**

1. **Rule Diffing**

   - Current: O(n²) comparison
   - Optimized: O(n) with hash maps
   - Expected improvement: 10x faster for large rule sets

2. **API Call Batching**

   - Batch multiple rule operations
   - Reduce round-trip time
   - Expected improvement: 3-5x faster sync

3. **Caching**

   - Cache translated rules
   - Cache provider responses
   - Cache validation results
   - Expected improvement: Near-instant for repeated operations

4. **Parallel Operations**
   - Parallel provider operations
   - Parallel rule validation
   - Parallel file I/O
   - Expected improvement: 2-3x faster for multi-provider

**Implementation:**

```typescript
// Optimized rule diffing
class RuleDiffer {
  diff<T extends { id: string }>(local: T[], remote: T[]): { toAdd: T[]; toUpdate: T[]; toDelete: T[] } {
    // Create hash maps for O(1) lookup
    const localMap = new Map(local.map((r) => [r.id, r]))
    const remoteMap = new Map(remote.map((r) => [r.id, r]))

    const toAdd: T[] = []
    const toUpdate: T[] = []
    const toDelete: T[] = []

    // Find additions and updates
    for (const [id, localRule] of localMap) {
      const remoteRule = remoteMap.get(id)
      if (!remoteRule) {
        toAdd.push(localRule)
      } else if (!this.isEqual(localRule, remoteRule)) {
        toUpdate.push(localRule)
      }
    }

    // Find deletions
    for (const [id, remoteRule] of remoteMap) {
      if (!localMap.has(id)) {
        toDelete.push(remoteRule)
      }
    }

    return { toAdd, toUpdate, toDelete }
  }
}

// Caching layer
class CacheService {
  private cache = new Map<string, CacheEntry>()
  private ttl = 5 * 60 * 1000 // 5 minutes

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key)
    if (!entry) return undefined

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key)
      return undefined
    }

    return entry.value as T
  }

  set<T>(key: string, value: T): void {
    this.cache.set(key, {
      value,
      timestamp: Date.now(),
    })
  }
}
```

---

## Implementation Plan

### Week 1-2: Foundation & Testing

- ✅ Create planning document
- [ ] Add Cloudflare provider tests
- [ ] Improve error messages
- [ ] Implement performance optimizations
- [ ] Create migration command structure

### Week 3-4: Migration Feature

- [ ] Implement compatibility checker
- [ ] Add migration report generator
- [ ] Implement migration execution
- [ ] Add migration tests

### Week 5-6: Expression Parser

- [ ] Implement lexer and parser
- [ ] Add validator
- [ ] Implement translator
- [ ] Add comprehensive tests

### Week 7-8: CI/CD Integration

- [ ] Create GitHub Actions workflow
- [ ] Develop official GitHub Action
- [ ] Write documentation
- [ ] Create example repositories

### Week 9-10: Polish & Release

- [ ] Fix bugs and edge cases
- [ ] Complete documentation
- [ ] Create video tutorials
- [ ] Prepare v2.1.0 release

---

## Success Criteria

### Migration Command

- [ ] Successfully migrates 95%+ of rules between providers
- [ ] Generates comprehensive migration reports
- [ ] Handles rollback correctly
- [ ] < 5% false positive warnings

### GitHub Actions

- [ ] Workflow works on GitHub Actions, GitLab CI, CircleCI
- [ ] 99.9% uptime in production
- [ ] Official action published to marketplace
- [ ] 100+ stars within 3 months

### Expression Parser

- [ ] Parses 99%+ of valid Cloudflare expressions
- [ ] Generates syntactically correct expressions
- [ ] Performance: < 10ms for typical expressions
- [ ] Comprehensive test coverage (> 90%)

### Quality Improvements

- [ ] Test coverage > 85%
- [ ] All errors have actionable suggestions
- [ ] 10x performance improvement in rule diffing
- [ ] Zero critical bugs in production

---

## Next Steps

1. **Immediate (This Week)**

   - [ ] Review and approve this planning document
   - [ ] Begin Cloudflare provider tests
   - [ ] Start error message improvements

2. **Short Term (Next 2 Weeks)**

   - [ ] Complete quality improvements
   - [ ] Begin migration command implementation
   - [ ] Start expression parser foundation

3. **Medium Term (Week 3-8)**

   - [ ] Complete migration feature
   - [ ] Complete expression parser
   - [ ] Create GitHub Actions workflows

4. **Release (Week 9-10)**
   - [ ] Polish and bug fixes
   - [ ] Documentation and examples
   - [ ] Release v2.1.0

---

_Last Updated: October 8, 2025_
_Status: Planning Complete → Ready for Implementation_
