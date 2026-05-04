# Configuration Schema Documentation

Complete reference for Vercel Doorman configuration files supporting both Vercel Firewall and Cloudflare WAF.

## Overview

Vercel Doorman uses a unified JSON configuration format that works across multiple firewall providers. The configuration is validated using JSON Schema and provides full TypeScript support.

## Schema URL

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json"
}
```

## Basic Structure

### Vercel Configuration

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "vercel",
  "projectId": "prj_abc123",
  "teamId": "team_xyz789",
  "rules": [],
  "ips": []
}
```

### Cloudflare Configuration

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "zone_abc123",
      "accountId": "acc_xyz789"
    }
  },
  "rules": [],
  "ips": []
}
```

### Multi-Provider Configuration

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
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
  "rules": [],
  "ips": []
}
```

## Root Configuration Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `$schema` | string | No | JSON Schema URL for validation |
| `provider` | string | No | Default provider (`"vercel"` or `"cloudflare"`) |
| `projectId` | string | Vercel Only | Vercel project ID |
| `teamId` | string | Vercel Only | Vercel team ID (optional) |
| `providers` | object | Multi-Provider | Provider-specific configurations |
| `rules` | array | Yes | Array of firewall rules |
| `ips` | array | No | Array of IP blocking rules |
| `version` | number | No | Configuration version |
| `firewallEnabled` | boolean | No | Enable/disable firewall |
| `updatedAt` | string | No | Last update timestamp |
| `metadata` | object | No | Additional metadata |

## Provider Configurations

### Vercel Provider

```json
{
  "providers": {
    "vercel": {
      "projectId": "prj_abc123",
      "teamId": "team_xyz789"
    }
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `projectId` | string | Yes | Vercel project ID |
| `teamId` | string | No | Vercel team ID |

### Cloudflare Provider

```json
{
  "providers": {
    "cloudflare": {
      "zoneId": "zone_abc123",
      "accountId": "acc_xyz789",
      "useAccountRules": false
    }
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `zoneId` | string | Yes | Cloudflare zone ID |
| `accountId` | string | No | Cloudflare account ID (enables Lists API) |
| `useAccountRules` | boolean | No | Use account-level rules |

## Rules Configuration

### Rule Structure

```json
{
  "id": "rule_block_bots",
  "name": "Block Bad Bots",
  "description": "Block malicious bots and crawlers",
  "active": true,
  "conditionGroup": [
    {
      "conditions": [
        {
          "type": "user_agent",
          "op": "sub",
          "value": "bot",
          "neg": false
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
```

### Rule Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | No | Unique rule identifier |
| `name` | string | Yes | Human-readable rule name |
| `description` | string | No | Rule description |
| `active` | boolean | Yes | Whether rule is enabled |
| `conditionGroup` | array | Yes | Array of condition groups (OR logic) |
| `action` | object | Yes | Action to take when rule matches |

### Condition Groups

Condition groups use OR logic between groups and AND logic within groups:

```json
{
  "conditionGroup": [
    {
      "conditions": [
        { "type": "path", "op": "pre", "value": "/admin" },
        { "type": "method", "op": "eq", "value": "POST" }
      ]
    },
    {
      "conditions": [
        { "type": "ip_address", "op": "eq", "value": "192.168.1.1" }
      ]
    }
  ]
}
```

This translates to: `(path starts with "/admin" AND method equals "POST") OR (IP equals "192.168.1.1")`

### Condition Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `type` | string | Yes | Condition type (see below) |
| `op` | string | Yes | Operator (see below) |
| `value` | string/number/array | Yes | Value to match against |
| `key` | string | No | Key for header/query/cookie conditions |
| `neg` | boolean | No | Negate the condition |

### Condition Types

| Type | Description | Example Value | Vercel | Cloudflare |
|------|-------------|---------------|--------|------------|
| `host` | Hostname | `"example.com"` | ✅ | ✅ |
| `path` | URL path | `"/api/users"` | ✅ | ✅ |
| `method` | HTTP method | `"POST"` | ✅ | ✅ |
| `header` | HTTP header | `"application/json"` | ✅ | ✅ |
| `query` | Query parameter | `"debug=true"` | ✅ | ✅ |
| `cookie` | Cookie value | `"session=abc123"` | ✅ | ✅ |
| `user_agent` | User agent string | `"Mozilla/5.0"` | ✅ | ✅ |
| `ip_address` | IP address | `"192.168.1.1"` | ✅ | ✅ |
| `geo_country` | Country code | `"US"` | ✅ | ✅ |
| `geo_continent` | Continent code | `"NA"` | ✅ | ✅ |
| `geo_city` | City name | `"New York"` | ✅ | ✅ |
| `protocol` | Protocol | `"HTTP/1.1"` | ✅ | ✅ |
| `scheme` | URL scheme | `"https"` | ✅ | ✅ |
| `environment` | Deployment environment | `"production"` | ✅ | ❌ |
| `region` | Vercel region | `"iad1"` | ✅ | ❌ |
| `target_path` | Target path | `"/api"` | ✅ | ❌ |
| `rate_limit_api_id` | Rate limit API ID | `"api_123"` | ✅ | ❌ |
| `ja3_digest` | JA3 fingerprint | `"abc123"` | ✅ | ❌ |
| `ja4_digest` | JA4 fingerprint | `"def456"` | ✅ | ❌ |

### Operators

| Operator | Description | Example | Vercel | Cloudflare |
|----------|-------------|---------|--------|------------|
| `eq` | Equals | `"POST"` | ✅ | ✅ |
| `pre` | Starts with | `"/api"` | ✅ | ✅ |
| `suf` | Ends with | `".php"` | ✅ | ✅ |
| `sub` | Contains | `"bot"` | ✅ | ✅ |
| `inc` | Is any of (array) | `["GET", "POST"]` | ✅ | ✅ |
| `re` | Regex match | `"\\.(php|asp)$"` | ✅ | ⚠️ Enterprise |
| `ex` | Exists | `true` | ✅ | ✅ |
| `nex` | Does not exist | `true` | ✅ | ✅ |

### Actions

#### Basic Actions

```json
{
  "action": {
    "mitigate": {
      "action": "deny"
    }
  }
}
```

| Action | Description | Vercel | Cloudflare |
|--------|-------------|--------|------------|
| `log` | Log only | ✅ | ✅ |
| `deny` | Block request | ✅ | ✅ |
| `allow` | Allow request | ✅ | ✅ |
| `challenge` | CAPTCHA challenge | ✅ | ✅ |
| `bypass` | Skip other rules | ✅ | ✅ |
| `rate_limit` | Rate limiting | ✅ | ✅ |
| `redirect` | HTTP redirect | ✅ | ✅ |

#### Rate Limiting Action

```json
{
  "action": {
    "mitigate": {
      "action": "rate_limit",
      "rateLimit": {
        "requests": 100,
        "window": "60s",
        "characteristics": ["ip.src"],
        "mitigationTimeout": 600,
        "countingExpression": ""
      }
    }
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `requests` | number | Yes | Number of requests allowed |
| `window` | string | Yes | Time window (e.g., "60s", "1m") |
| `characteristics` | array | No | Rate limiting characteristics |
| `mitigationTimeout` | number | No | Timeout duration in seconds |
| `countingExpression` | string | No | Custom counting expression |

#### Redirect Action

```json
{
  "action": {
    "mitigate": {
      "action": "redirect",
      "redirect": {
        "location": "https://example.com/blocked",
        "permanent": false
      }
    }
  }
}
```

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `location` | string | Yes | Redirect URL |
| `permanent` | boolean | No | Use 301 (permanent) vs 302 (temporary) |

## IP Blocking Rules

### IP Rule Structure

```json
{
  "id": "ip_block_suspicious",
  "ip": "192.168.1.100/32",
  "hostname": "suspicious-host",
  "action": "deny",
  "notes": "Blocked due to suspicious activity"
}
```

### IP Rule Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | No | Unique identifier |
| `ip` | string | Yes | IP address or CIDR range |
| `hostname` | string | No | Hostname for documentation |
| `action` | string | Yes | Action (currently only "deny") |
| `notes` | string | No | Notes about the block |

### IP Address Formats

```json
{
  "ips": [
    { "ip": "192.168.1.1/32", "action": "deny" },      // Single IP
    { "ip": "192.168.1.0/24", "action": "deny" },      // Subnet
    { "ip": "10.0.0.0/8", "action": "deny" }           // Large range
  ]
}
```

## Metadata

### Configuration Metadata

```json
{
  "metadata": {
    "version": 5,
    "updatedAt": "2025-01-15T10:00:00Z",
    "createdBy": "user@example.com",
    "environment": "production",
    "migrationSource": "vercel",
    "migrationDate": "2025-01-15T10:00:00Z",
    "warnings": [
      "Rule 'complex_regex' simplified for Cloudflare compatibility"
    ]
  }
}
```

| Property | Type | Description |
|----------|------|-------------|
| `version` | number | Configuration version number |
| `updatedAt` | string | ISO 8601 timestamp of last update |
| `createdBy` | string | User who created the configuration |
| `environment` | string | Environment (production, staging, etc.) |
| `migrationSource` | string | Source provider for migrations |
| `migrationDate` | string | Date of migration |
| `warnings` | array | Migration or validation warnings |

## Environment Variables

Configuration can reference environment variables:

### Vercel Environment Variables

```bash
VERCEL_TOKEN="your_vercel_token"
VERCEL_PROJECT_ID="prj_abc123"
VERCEL_TEAM_ID="team_xyz789"
```

### Cloudflare Environment Variables

```bash
CLOUDFLARE_API_TOKEN="your_api_token"
CLOUDFLARE_ZONE_ID="zone_abc123"
CLOUDFLARE_ACCOUNT_ID="acc_xyz789"
```

### Provider Selection

```bash
DOORMAN_PROVIDER="cloudflare"  # or "vercel"
```

## Configuration Examples

### Simple Bot Blocking

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "zone_abc123"
    }
  },
  "rules": [
    {
      "name": "Block Bad Bots",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "user_agent",
              "op": "sub",
              "value": "bot"
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
  ]
}
```

### Advanced Security Configuration

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "zone_abc123",
      "accountId": "acc_xyz789"
    }
  },
  "rules": [
    {
      "name": "Admin Path Protection",
      "description": "Protect admin paths with geo-blocking and rate limiting",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            { "type": "path", "op": "pre", "value": "/admin" },
            { "type": "geo_country", "op": "inc", "value": ["CN", "RU"] }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "deny"
        }
      }
    },
    {
      "name": "API Rate Limiting",
      "description": "Rate limit API endpoints",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            { "type": "path", "op": "pre", "value": "/api/" },
            { "type": "method", "op": "eq", "value": "POST" }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "rate_limit",
          "rateLimit": {
            "requests": 100,
            "window": "60s",
            "characteristics": ["ip.src"]
          }
        }
      }
    }
  ],
  "ips": [
    {
      "ip": "192.168.1.100/32",
      "hostname": "known-attacker",
      "action": "deny",
      "notes": "Blocked due to repeated attacks"
    }
  ]
}
```

### Multi-Provider Configuration

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
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
      "name": "Universal Bot Protection",
      "description": "Bot protection that works on both providers",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "user_agent",
              "op": "sub",
              "value": "bot"
            }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "challenge"
        }
      }
    }
  ]
}
```

## Validation

### Schema Validation

The configuration is automatically validated against the JSON Schema:

```bash
# Validate configuration
vercel-doorman validate

# Validate specific file
vercel-doorman validate --config production.config.json

# Strict validation with warnings
vercel-doorman validate --strict
```

### Common Validation Errors

#### Missing Required Fields

```json
{
  "error": "Missing required property 'name'",
  "path": "/rules/0",
  "value": { "active": true }
}
```

#### Invalid Condition Type

```json
{
  "error": "Invalid condition type 'invalid_type'",
  "path": "/rules/0/conditionGroup/0/conditions/0/type",
  "allowedValues": ["host", "path", "method", ...]
}
```

#### Invalid IP Format

```json
{
  "error": "Invalid IP address format",
  "path": "/ips/0/ip",
  "value": "999.999.999.999"
}
```

### Provider-Specific Validation

#### Cloudflare Validation

- Account ID required for Lists API
- Zone ID must be valid and accessible
- Some features require specific Cloudflare plans

#### Vercel Validation

- Project ID must be valid and accessible
- Team ID required for team projects
- Environment conditions only work with Vercel

## Migration Considerations

### Vercel to Cloudflare

- Environment-based conditions are removed
- Regex patterns may be simplified
- Some Vercel-specific fields are not supported

### Cloudflare to Vercel

- Advanced Cloudflare features may not translate
- Bot management features are lost
- Lists API features become individual rules

### Translation Warnings

```json
{
  "warnings": [
    {
      "rule": "complex_regex_rule",
      "message": "Regex pattern simplified to substring match",
      "impact": "May affect rule accuracy"
    },
    {
      "rule": "environment_rule",
      "message": "Environment condition removed (not supported by Cloudflare)",
      "impact": "Rule will apply to all environments"
    }
  ]
}
```

## Best Practices

### Configuration Structure

1. **Use descriptive names** for rules and IPs
2. **Add descriptions** to explain rule purposes
3. **Group related conditions** logically
4. **Use CIDR notation** for IP ranges
5. **Include metadata** for tracking changes

### Performance Optimization

1. **Order rules by frequency** (most common first)
2. **Use specific conditions** to reduce processing
3. **Avoid complex regex** when possible
4. **Combine similar rules** where appropriate
5. **Use IP lists** instead of individual IP rules

### Security Best Practices

1. **Test rules in staging** before production
2. **Start with log actions** before blocking
3. **Monitor rule effectiveness** regularly
4. **Keep backups** of working configurations
5. **Document rule purposes** and business logic

## Troubleshooting

### Schema Validation Issues

```bash
# Check schema URL is accessible
curl -I https://doorman.griffen.codes/schema.json

# Validate with verbose output
vercel-doorman validate --verbose

# Check specific rule syntax
vercel-doorman validate --rule-id "rule_name"
```

### Provider Compatibility

```bash
# Check provider-specific features
vercel-doorman validate --provider cloudflare --check-compatibility

# Preview cross-provider migration
vercel-doorman migrate --from vercel --to cloudflare --dry-run
```

For more troubleshooting help, see the [Troubleshooting Guide](cloudflare/troubleshooting.md).