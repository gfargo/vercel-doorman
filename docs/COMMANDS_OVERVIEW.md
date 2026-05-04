# Vercel Doorman Commands Overview

Multi-provider firewall management supporting both Vercel Firewall and Cloudflare WAF.

## 🚀 **New Commands Added**

### Core Workflow Commands

#### `init` - Initialize New Project

```bash
# Vercel Firewall
vercel-doorman init [template]
vercel-doorman init --interactive

# Cloudflare WAF
vercel-doorman init --provider cloudflare --interactive
vercel-doorman init security-focused --provider cloudflare
```

- Creates a new configuration file for specified provider
- Templates: `empty`, `basic`, `security-focused`
- Interactive mode guides through setup process
- Validates credentials during initialization

#### `status` - Quick Health Check

```bash
# Auto-detect provider from config
vercel-doorman status

# Specific provider
vercel-doorman status --provider vercel
vercel-doorman status --provider cloudflare
```

- Shows sync status between local and remote
- Displays provider-specific connection status
- Includes configuration health score
- Quick overview of pending changes
- Provider feature availability (e.g., Lists API for Cloudflare)

#### `diff` - Detailed Change Analysis

```bash
# Auto-detect provider
vercel-doorman diff [--format json|table]

# Provider-specific
vercel-doorman diff --provider cloudflare --format json
vercel-doorman diff --provider vercel --show-warnings

# Cross-provider comparison
vercel-doorman diff --source vercel --target cloudflare
```

- Shows detailed differences between local and remote
- Supports JSON output for CI/CD integration
- Color-coded change indicators
- Translation warnings for cross-provider differences

### Advanced Workflow Commands

#### `watch` - Continuous Sync

```bash
# Auto-detect provider
vercel-doorman watch [--interval 1000]

# Provider-specific
vercel-doorman watch --provider cloudflare --interval 2000
vercel-doorman watch --provider vercel
```

- Watches config file for changes
- Automatically syncs changes to specified provider
- Perfect for development workflows
- Graceful error handling and retry logic

#### `backup` - Configuration Backup & Restore

```bash
# Create backup
vercel-doorman backup

# List backups
vercel-doorman backup --list

# Restore from backup
vercel-doorman backup --restore backup-file.json
```

- Creates timestamped backups
- Stores metadata with each backup
- Easy restore functionality

#### `export` - Multi-Format Export

```bash
# Export current configuration
vercel-doorman export --format [json|yaml|terraform|markdown]

# Export from specific provider
vercel-doorman export --provider cloudflare --format markdown
vercel-doorman export --provider vercel --format terraform

# Cross-provider export
vercel-doorman export --source vercel --target cloudflare --format json
```

- Export configurations in various formats
- Supports both local and remote sources
- Generate documentation and reports
- Cross-provider configuration translation

#### `migrate` - Cross-Provider Migration

```bash
# Preview migration
vercel-doorman migrate --from vercel --to cloudflare --dry-run

# Perform migration
vercel-doorman migrate --from vercel --to cloudflare --output cloudflare.config.json

# Migration with custom options
vercel-doorman migrate --from vercel --to cloudflare --preserve-ids --show-warnings
```

- Migrate configurations between providers
- Automatic rule translation with warnings
- Dry-run mode for preview
- Preserves rule intent across providers

### Existing Commands (Enhanced)

#### `sync` - Deploy Configuration

```bash
# Auto-detect provider
vercel-doorman sync

# Provider-specific
vercel-doorman sync --provider cloudflare
vercel-doorman sync --provider vercel --config production.config.json
```

- Deploys local configuration to specified provider
- Properly updates local version after sync
- Better error handling and validation
- Provider-specific optimizations

#### `download` - Import Remote Configuration

```bash
# Auto-detect provider
vercel-doorman download

# Provider-specific
vercel-doorman download --provider cloudflare
vercel-doorman download --provider vercel --output backup.config.json
```

- Imports remote configuration to local file
- Works seamlessly with sync command
- Preserves local metadata and comments

#### `list` - Display Current Rules

```bash
# Auto-detect provider
vercel-doorman list

# Provider-specific with details
vercel-doorman list --provider cloudflare --verbose
vercel-doorman list --provider vercel --format json
```

- Shows current deployed firewall rules
- Provider-specific rule details
- Multiple output formats

#### `validate` - Configuration Validation

```bash
# Validate current config
vercel-doorman validate

# Provider-specific validation
vercel-doorman validate --provider cloudflare --strict
vercel-doorman validate --config staging.config.json
```

- Validates config syntax and rules
- Provider-specific validation rules
- Feature compatibility checking

#### `template` - Add Rule Templates

```bash
# List available templates
vercel-doorman template

# Add template for specific provider
vercel-doorman template add bad-bots --provider cloudflare
vercel-doorman template add wordpress --provider vercel
```

- Adds predefined rule templates
- Provider-specific template variations
- Template compatibility checking

## 🎯 **Improved Developer Experience**

### New Package Scripts

```bash
# Development
npm run dev              # Alias for start
npm run doorman          # Another alias for start

# Testing
npm run test:coverage    # Run tests with coverage
npm run test:ci          # CI-friendly test run

# Validation
npm run validate:examples # Validate all example configs
```

### Enhanced Error Handling

- Better error messages with context
- Graceful handling of network issues
- Improved validation feedback

### Performance Monitoring

- Built-in performance timing utilities
- Debug logging for troubleshooting
- Health scoring for configurations

## 📊 **Configuration Health Scoring**

The new health checker evaluates:

- **Rule Naming** - Proper ID formats and descriptive names
- **Security Best Practices** - Rate limiting, bot protection
- **Performance Impact** - Rule complexity and regex usage
- **Maintainability** - Disabled rules, duplicates, versioning

Score ranges:

- 80-100: Excellent ✅
- 60-79: Good ⚠️
- 0-59: Needs Improvement ❌

## 🔄 **Recommended Workflows**

### Development Workflow

#### Vercel Firewall

```bash
# 1. Initialize project
vercel-doorman init security-focused

# 2. Edit configuration
# ... make changes to config file ...

# 3. Watch for changes during development
vercel-doorman watch

# 4. Check status periodically
vercel-doorman status
```

#### Cloudflare WAF

```bash
# 1. Initialize Cloudflare project
vercel-doorman init --provider cloudflare --interactive

# 2. Add security templates
vercel-doorman template add bad-bots --provider cloudflare

# 3. Watch for changes during development
vercel-doorman watch --provider cloudflare

# 4. Check status and connectivity
vercel-doorman status --provider cloudflare
```

### Production Workflow

#### Single Provider

```bash
# 1. Create backup before changes
vercel-doorman backup

# 2. Check what will change
vercel-doorman diff --provider cloudflare

# 3. Validate configuration
vercel-doorman validate

# 4. Apply changes
vercel-doorman sync --provider cloudflare

# 5. Verify sync completed
vercel-doorman status --provider cloudflare
```

#### Multi-Provider Deployment

```bash
# 1. Create backups for both providers
vercel-doorman backup --name "pre-deploy-vercel" --provider vercel
vercel-doorman backup --name "pre-deploy-cloudflare" --provider cloudflare

# 2. Validate both configurations
vercel-doorman validate --config vercel.config.json
vercel-doorman validate --config cloudflare.config.json

# 3. Deploy to both providers
vercel-doorman sync --config vercel.config.json --provider vercel
vercel-doorman sync --config cloudflare.config.json --provider cloudflare

# 4. Verify both deployments
vercel-doorman status --provider vercel
vercel-doorman status --provider cloudflare
```

### CI/CD Integration

#### Single Provider Pipeline

```bash
# Validate in CI
vercel-doorman validate --config production.config.json

# Check for changes (JSON output for parsing)
vercel-doorman diff --provider cloudflare --format json

# Deploy changes
vercel-doorman sync --config production.config.json --provider cloudflare
```

#### Multi-Provider Pipeline

```bash
# Validate all configurations
vercel-doorman validate --config vercel-prod.config.json
vercel-doorman validate --config cloudflare-prod.config.json

# Check for changes in both providers
vercel-doorman diff --provider vercel --format json > vercel-changes.json
vercel-doorman diff --provider cloudflare --format json > cloudflare-changes.json

# Deploy to both providers
vercel-doorman sync --config vercel-prod.config.json --provider vercel
vercel-doorman sync --config cloudflare-prod.config.json --provider cloudflare

# Generate deployment report
vercel-doorman export --format markdown --output deployment-report.md
```

#### Migration Pipeline

```bash
# Preview migration in CI
vercel-doorman migrate --from vercel --to cloudflare --dry-run --format json

# Perform migration if approved
vercel-doorman migrate --from vercel --to cloudflare --output migrated.config.json

# Deploy migrated configuration
vercel-doorman sync --config migrated.config.json --provider cloudflare
```

## 🌐 **Provider-Specific Features**

### Vercel Firewall

- **Environment-based rules** - Rules that apply to specific deployment environments
- **Branch-specific protection** - Different rules for preview deployments
- **Vercel-native integration** - Seamless integration with Vercel platform
- **Simple setup** - Quick configuration with Vercel tokens

### Cloudflare WAF

- **Advanced bot protection** - AI-powered bot detection and mitigation
- **Lists API integration** - Efficient bulk IP management
- **Global threat intelligence** - Reputation-based blocking
- **Advanced rate limiting** - Sophisticated rate limiting with custom characteristics
- **Multiple challenge types** - CAPTCHA, JavaScript, and managed challenges
- **Account-level rules** - Rules that apply across multiple zones

### Cross-Provider Features

- **Rule translation** - Automatic conversion between provider formats
- **Feature compatibility checking** - Warnings for unsupported features
- **Migration tools** - Seamless migration between providers
- **Unified configuration** - Single configuration format for both providers

## 🛠 **Technical Improvements**

### Fixed Issues

- ✅ Sync/Download version inconsistency resolved
- ✅ Better validation timing and retries
- ✅ Improved error handling for edge cases
- ✅ Enhanced test coverage (50+ new tests)

### New Utilities

- Performance measurement tools
- Configuration health checker
- Enhanced logging and debugging
- Better TypeScript types and validation

### Code Quality

- Comprehensive test suite
- Better error messages
- Consistent command patterns
- Improved documentation

## 🎉 **Benefits**

1. **Faster Development** - Watch mode and status checks
2. **Better Reliability** - Fixed sync issues and better error handling
3. **Enhanced Visibility** - Health scoring and detailed diffs
4. **Backup Safety** - Easy backup and restore functionality
5. **Multi-Format Support** - Export to various formats for documentation
6. **CI/CD Ready** - JSON outputs and validation commands

The enhanced Vercel Doorman now provides a complete multi-provider toolkit for managing firewall configurations across Vercel and Cloudflare with confidence and efficiency!

## 📖 **Additional Resources**

### Documentation

- **[Cloudflare Setup Guide](cloudflare/setup.md)** - Complete Cloudflare WAF setup
- **[Migration Guide](cloudflare/migration.md)** - Migrate between providers
- **[Troubleshooting Guide](cloudflare/troubleshooting.md)** - Common issues and solutions
- **[Feature Comparison](cloudflare/comparison.md)** - Vercel vs Cloudflare comparison

### Quick References

- **[Cloudflare Quick Start](cloudflare/quickstart.md)** - Get started in 5 minutes
- **[Command Examples](COMMAND_COMPARISON.md)** - Side-by-side command examples
- **[Multi-Provider Summary](MULTI_PROVIDER_SUMMARY.md)** - Overview of multi-provider features
