# Migration Guide: Vercel to Cloudflare

Complete guide for migrating your firewall rules from Vercel Firewall to Cloudflare WAF using Vercel Doorman.

## Overview

This guide covers:
- Understanding the differences between Vercel and Cloudflare
- Step-by-step migration process
- Feature compatibility and limitations
- Testing and validation
- Rollback procedures

## Before You Begin

### Prerequisites

- Existing Vercel Doorman configuration
- Cloudflare account with domain added
- Cloudflare API token with proper permissions
- Backup of your current Vercel configuration

### Important Considerations

⚠️ **Migration is not reversible through automated tools**. Always backup your configurations before proceeding.

⚠️ **Some features may not translate perfectly**. Review the compatibility matrix below.

⚠️ **Test thoroughly** in a staging environment before applying to production.

## Feature Compatibility Matrix

| Feature | Vercel Support | Cloudflare Support | Translation | Notes |
|---------|----------------|-------------------|-------------|-------|
| **Path Matching** | ✅ Full | ✅ Full | ✅ Direct | Perfect compatibility |
| **Method Filtering** | ✅ Full | ✅ Full | ✅ Direct | Perfect compatibility |
| **IP Blocking** | ✅ Full | ✅ Full | ✅ Direct | Uses Cloudflare Lists when Account ID provided |
| **User Agent** | ✅ Full | ✅ Full | ✅ Direct | Perfect compatibility |
| **Headers** | ✅ Full | ✅ Full | ✅ Direct | Perfect compatibility |
| **Geo-blocking** | ✅ Full | ✅ Full | ✅ Direct | Perfect compatibility |
| **Rate Limiting** | ✅ Full | ✅ Full | ⚠️ Modified | Different configuration format |
| **Regex Matching** | ✅ Full | ⚠️ Enterprise Only | ⚠️ Limited | Falls back to contains/starts_with |
| **Environment Variables** | ✅ Full | ❌ Not Applicable | ❌ Removed | Vercel-specific feature |
| **Custom Response** | ✅ Full | ✅ Full | ✅ Direct | Perfect compatibility |
| **Redirects** | ✅ Full | ✅ Full | ✅ Direct | Perfect compatibility |
| **Challenge Actions** | ✅ Basic | ✅ Advanced | ✅ Enhanced | Cloudflare offers more challenge types |

### Legend
- ✅ **Direct**: Feature translates perfectly
- ⚠️ **Modified**: Feature works but with changes
- ❌ **Removed**: Feature not available in target provider

## Migration Process

### Step 1: Backup Current Configuration

```bash
# Create a backup of your current Vercel configuration
vercel-doorman backup create --name "pre-cloudflare-migration"

# Export current rules for reference
vercel-doorman export --format json --output vercel-backup.json
```

### Step 2: Set Up Cloudflare

Follow the [Cloudflare Setup Guide](setup.md) to:
1. Create API token
2. Find Zone ID and Account ID
3. Configure environment variables

### Step 3: Preview Migration

Use the migration preview to see what will change:

```bash
# Preview migration without making changes
vercel-doorman migrate --from vercel --to cloudflare --dry-run

# Save migration preview to file
vercel-doorman migrate --from vercel --to cloudflare --dry-run --output migration-preview.json
```

Example preview output:
```
Migration Preview: Vercel → Cloudflare
=====================================

✅ Rules that will migrate perfectly (5):
  - block_admin_paths
  - rate_limit_api
  - block_bad_ips
  - geo_block_countries
  - user_agent_filter

⚠️  Rules with modifications (2):
  - complex_regex_rule → Will use 'contains' instead of regex
  - environment_based_rule → Environment condition will be removed

❌ Rules that cannot migrate (1):
  - vercel_specific_rule → Uses Vercel-only features

📊 Summary:
  - Total rules: 8
  - Perfect migration: 5 (62.5%)
  - Modified migration: 2 (25%)
  - Cannot migrate: 1 (12.5%)
```

### Step 4: Create Cloudflare Configuration

Generate the new Cloudflare configuration:

```bash
# Create new Cloudflare config from Vercel config
vercel-doorman migrate --from vercel --to cloudflare --output cloudflare-firewall.config.json
```

This creates a new configuration file with:
- Translated rules
- Cloudflare provider settings
- Migration notes and warnings

### Step 5: Review Generated Configuration

Open the generated `cloudflare-firewall.config.json` and review:

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "your_zone_id",
      "accountId": "your_account_id"
    }
  },
  "rules": [
    {
      "id": "migrated_block_admin_paths",
      "name": "Block Admin Paths (Migrated)",
      "description": "Migrated from Vercel: Block access to admin paths",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "path",
              "op": "pre",
              "value": "/admin"
            }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "deny"
        }
      }
    }
  ],
  "ips": [
    {
      "ip": "192.168.1.100",
      "hostname": "migrated-bad-actor",
      "action": "deny",
      "notes": "Migrated from Vercel configuration"
    }
  ],
  "metadata": {
    "migrationSource": "vercel",
    "migrationDate": "2025-01-15T10:00:00Z",
    "originalRuleCount": 8,
    "migratedRuleCount": 7,
    "warnings": [
      "Rule 'complex_regex_rule' changed from regex to contains matching",
      "Rule 'environment_based_rule' had environment condition removed"
    ]
  }
}
```

### Step 6: Validate New Configuration

```bash
# Validate the new configuration
vercel-doorman validate --config cloudflare-firewall.config.json

# Test connectivity
vercel-doorman status --config cloudflare-firewall.config.json
```

### Step 7: Test in Staging

Before applying to production:

1. **Create a test subdomain** in Cloudflare
2. **Apply rules to test environment**:
   ```bash
   vercel-doorman sync --config cloudflare-firewall.config.json --provider cloudflare
   ```
3. **Test functionality** thoroughly
4. **Verify rule behavior** matches expectations

### Step 8: Deploy to Production

Once testing is complete:

```bash
# Final sync to production
vercel-doorman sync --config cloudflare-firewall.config.json --provider cloudflare

# Verify deployment
vercel-doorman status --config cloudflare-firewall.config.json
```

### Step 9: Monitor and Adjust

After migration:

1. **Monitor Cloudflare Analytics** for rule effectiveness
2. **Check for false positives** in blocked traffic
3. **Adjust rules** as needed based on real traffic patterns
4. **Update documentation** with new Cloudflare-specific procedures

## Common Migration Scenarios

### Scenario 1: Simple Website Protection

**Original Vercel Config:**
```json
{
  "rules": [
    {
      "id": "block_admin",
      "name": "Block Admin Access",
      "conditionGroup": [
        {
          "conditions": [
            { "type": "path", "op": "pre", "value": "/admin" }
          ]
        }
      ],
      "action": { "mitigate": { "action": "deny" } }
    }
  ]
}
```

**Migrated Cloudflare Config:**
```json
{
  "provider": "cloudflare",
  "rules": [
    {
      "id": "migrated_block_admin",
      "name": "Block Admin Access (Migrated)",
      "conditionGroup": [
        {
          "conditions": [
            { "type": "path", "op": "pre", "value": "/admin" }
          ]
        }
      ],
      "action": { "mitigate": { "action": "deny" } }
    }
  ]
}
```

**Result:** ✅ Perfect migration, no changes needed.

### Scenario 2: Complex Regex Rules

**Original Vercel Config:**
```json
{
  "rules": [
    {
      "id": "block_suspicious_paths",
      "name": "Block Suspicious Paths",
      "conditionGroup": [
        {
          "conditions": [
            { 
              "type": "path", 
              "op": "re", 
              "value": "\\.(php|asp|jsp)$" 
            }
          ]
        }
      ],
      "action": { "mitigate": { "action": "deny" } }
    }
  ]
}
```

**Migrated Cloudflare Config:**
```json
{
  "rules": [
    {
      "id": "migrated_block_suspicious_paths",
      "name": "Block Suspicious Paths (Modified)",
      "conditionGroup": [
        {
          "conditions": [
            { "type": "path", "op": "suf", "value": ".php" }
          ]
        },
        {
          "conditions": [
            { "type": "path", "op": "suf", "value": ".asp" }
          ]
        },
        {
          "conditions": [
            { "type": "path", "op": "suf", "value": ".jsp" }
          ]
        }
      ],
      "action": { "mitigate": { "action": "deny" } }
    }
  ]
}
```

**Result:** ⚠️ Modified - Regex converted to multiple suffix conditions.

### Scenario 3: Rate Limiting

**Original Vercel Config:**
```json
{
  "rules": [
    {
      "id": "api_rate_limit",
      "name": "API Rate Limit",
      "conditionGroup": [
        {
          "conditions": [
            { "type": "path", "op": "pre", "value": "/api/" }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "rate_limit",
          "rateLimit": {
            "requests": 100,
            "window": "60s"
          }
        }
      }
    }
  ]
}
```

**Migrated Cloudflare Config:**
```json
{
  "rules": [
    {
      "id": "migrated_api_rate_limit",
      "name": "API Rate Limit (Migrated)",
      "conditionGroup": [
        {
          "conditions": [
            { "type": "path", "op": "pre", "value": "/api/" }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "rate_limit",
          "rateLimit": {
            "requests": 100,
            "window": "60s"
          }
        }
      }
    }
  ]
}
```

**Result:** ✅ Perfect migration, rate limiting works the same way.

## Handling Migration Warnings

### Regex to Simple Matching

**Warning:** `Rule 'pattern_match' changed from regex to contains matching`

**Action Required:**
1. Review the original regex pattern
2. Determine if simple matching is sufficient
3. If not, consider creating multiple rules or using Cloudflare Enterprise features

### Environment-Based Rules

**Warning:** `Rule 'env_rule' had environment condition removed`

**Action Required:**
1. Remove environment-based conditions (Cloudflare doesn't support this)
2. Consider using separate configurations for different environments
3. Use Cloudflare's zone-based separation instead

### Complex Nested Conditions

**Warning:** `Rule 'complex_rule' simplified due to nesting limitations`

**Action Required:**
1. Review the simplified logic
2. Test thoroughly to ensure security isn't compromised
3. Consider splitting into multiple rules if needed

## Rollback Procedures

If you need to rollback to Vercel:

### Option 1: Restore from Backup

```bash
# List available backups
vercel-doorman backup list

# Restore previous configuration
vercel-doorman backup restore --name "pre-cloudflare-migration"

# Sync back to Vercel
vercel-doorman sync --provider vercel
```

### Option 2: Reverse Migration

```bash
# Export current Cloudflare config
vercel-doorman export --provider cloudflare --output current-cloudflare.json

# Migrate back to Vercel format
vercel-doorman migrate --from cloudflare --to vercel --input current-cloudflare.json

# Sync to Vercel
vercel-doorman sync --provider vercel
```

## Post-Migration Checklist

- [ ] All critical rules are active in Cloudflare
- [ ] IP blocking is working correctly
- [ ] Rate limiting is functioning as expected
- [ ] No false positives in legitimate traffic
- [ ] Cloudflare Analytics show expected rule triggers
- [ ] Team is trained on new Cloudflare-specific procedures
- [ ] Documentation updated with new provider information
- [ ] Monitoring alerts updated for Cloudflare metrics
- [ ] Backup procedures updated for Cloudflare configs

## Troubleshooting Migration Issues

### Issue: Rules Not Syncing

**Symptoms:**
- `vercel-doorman sync` completes but rules don't appear in Cloudflare
- API errors during sync

**Solutions:**
1. Verify API token permissions
2. Check Zone ID is correct
3. Validate rule syntax with `vercel-doorman validate`

### Issue: Rate Limiting Not Working

**Symptoms:**
- Rate limiting rules appear in Cloudflare but don't trigger
- Traffic not being limited as expected

**Solutions:**
1. Check rule conditions are correct
2. Verify rate limiting thresholds are appropriate
3. Review Cloudflare Analytics for rule triggers

### Issue: IP Blocking Ineffective

**Symptoms:**
- Blocked IPs still accessing the site
- IP rules not appearing in Cloudflare

**Solutions:**
1. Ensure Account ID is provided for Lists API
2. Check IP format (CIDR notation may be required)
3. Verify rule priority and ordering

## Advanced Migration Topics

### Migrating Multiple Environments

For organizations with multiple environments:

```bash
# Migrate staging environment
vercel-doorman migrate --from vercel --to cloudflare \
  --config staging.vercel.config.json \
  --output staging.cloudflare.config.json

# Migrate production environment  
vercel-doorman migrate --from vercel --to cloudflare \
  --config production.vercel.config.json \
  --output production.cloudflare.config.json
```

### Custom Migration Scripts

For complex migrations, create custom scripts:

```javascript
// migration-script.js
const { migrate } = require('vercel-doorman');

async function customMigration() {
  const vercelConfig = await loadVercelConfig();
  const cloudflareConfig = await migrate(vercelConfig, {
    provider: 'cloudflare',
    customRules: {
      // Custom transformation logic
    }
  });
  
  // Apply custom business logic
  cloudflareConfig.rules = cloudflareConfig.rules.map(rule => {
    // Custom rule modifications
    return rule;
  });
  
  await saveCloudflareConfig(cloudflareConfig);
}
```

### Gradual Migration

For large rule sets, consider gradual migration:

1. **Phase 1**: Migrate critical security rules
2. **Phase 2**: Migrate rate limiting rules
3. **Phase 3**: Migrate remaining rules
4. **Phase 4**: Optimize and consolidate

## Getting Help

- **Documentation**: [docs.doorman.griffen.codes](https://docs.doorman.griffen.codes)
- **Migration Issues**: [GitHub Issues](https://github.com/gfargo/vercel-doorman/issues)
- **Cloudflare Support**: [Cloudflare Community](https://community.cloudflare.com/)
- **Professional Services**: Contact for complex migration assistance

## Next Steps

After successful migration:

1. **Optimize Rules**: Review and optimize rules for Cloudflare-specific features
2. **Enable Advanced Features**: Explore Cloudflare-only features like Bot Fight Mode
3. **Set Up Monitoring**: Configure Cloudflare Analytics and alerts
4. **Train Team**: Ensure team understands new Cloudflare workflows
5. **Update CI/CD**: Update deployment pipelines for Cloudflare provider