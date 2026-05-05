---
name: vercel-doorman
description: 'Use when managing Vercel or Cloudflare WAF rules as code, configuring firewall rules, IP blocking, rate limiting, bot protection, or automating multi-provider security configuration deployment with Doorman CLI.'
---

# Vercel Doorman

Multi-provider WAF automation as code. Manage Vercel Firewall and Cloudflare WAF rules in version-controlled JSON files with automated deployment via CLI.

## Installation

```bash
npm install -g vercel-doorman
# or
pnpm add -g vercel-doorman
```

## Quick Start

```bash
# 1. Setup guide
vercel-doorman setup

# 2. Interactive project init
vercel-doorman init --interactive

# 3. Or import existing rules from your provider
vercel-doorman download

# 4. Check configuration health
vercel-doorman status

# 5. Deploy rules
vercel-doorman sync
```

## Configuration

Doorman uses `.doorman.json` in your project root (also supports legacy `vercel-firewall.config.json`). JSON Schema available at `https://doorman.griffen.codes/schema.json`.

### Vercel Configuration

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "projectId": "prj_abc123",
  "teamId": "team_xyz789",
  "rules": [
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
  ],
  "ips": [
    {
      "ip": "192.168.1.100",
      "hostname": "suspicious-host",
      "action": "deny"
    }
  ]
}
```

### Cloudflare Configuration

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
      "id": "rule_block_bots",
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
  ],
  "ips": []
}
```

### Rule Structure

- `conditionGroup[]` — array of condition groups (OR between groups, AND within a group)
- `conditions[]` — match criteria with `type`, `op`, `value`
- `action` — response: `deny`, `challenge`, `rate_limit`, `redirect`
- `active` — enable/disable without deleting

### Condition Types

`path`, `user_agent`, `ip_address`, `geo_country`, `geo_city`, `geo_continent`, `header`, `method`, `host`, `query`, `cookie`, `scheme`

### Operators

`eq` (equals), `pre` (prefix/starts_with), `suf` (suffix/ends_with), `sub` (substring/contains), `inc` (in/any of), `re` (regex/matches), `ex` (exists), `nex` (not exists)

### Action Types

```json
// Deny
{ "mitigate": { "action": "deny" } }

// Rate limit
{ "mitigate": { "action": "rate_limit", "rateLimit": { "requests": 100, "window": "60s" } } }

// Challenge
{ "mitigate": { "action": "challenge" } }

// Redirect
{ "mitigate": { "action": "redirect", "redirect": { "location": "https://example.com", "permanent": false } } }
```

## Environment Variables

### Vercel

```bash
export VERCEL_TOKEN="your-api-token"
export VERCEL_PROJECT_ID="prj_abc123"
export VERCEL_TEAM_ID="team_xyz789"
```

### Cloudflare

```bash
export CLOUDFLARE_API_TOKEN="your-api-token"
export CLOUDFLARE_ZONE_ID="your-zone-id"
export CLOUDFLARE_ACCOUNT_ID="your-account-id"  # optional, enables Lists API
```

### Provider Selection

```bash
export DOORMAN_PROVIDER="cloudflare"  # or "vercel" (auto-detected from config)
```

Or use a `.env` file (add to `.gitignore`).

## Commands

All commands support `--provider vercel|cloudflare` to target a specific provider. Provider is auto-detected from config when not specified.

### Setup & Init

| Command                                                   | Description                            |
| --------------------------------------------------------- | -------------------------------------- |
| `vercel-doorman setup`                                    | Show setup guide with links            |
| `vercel-doorman init --interactive`                       | Create config with interactive prompts |
| `vercel-doorman init --provider cloudflare --interactive` | Init for Cloudflare                    |
| `vercel-doorman init security-focused`                    | Start with security templates          |

### Status & Info

| Command                                       | Description                               |
| --------------------------------------------- | ----------------------------------------- |
| `vercel-doorman status`                       | Sync status + configuration health score  |
| `vercel-doorman status --provider cloudflare` | Cloudflare-specific status                |
| `vercel-doorman list`                         | Display current deployed rules            |
| `vercel-doorman list 1`                       | List rules from specific version          |
| `vercel-doorman diff`                         | Color-coded diff between local and remote |
| `vercel-doorman diff --format json`           | JSON diff for CI/CD                       |

### Configuration Management

| Command                                     | Description                                          |
| ------------------------------------------- | ---------------------------------------------------- |
| `vercel-doorman sync`                       | Apply local changes to provider (local → remote)     |
| `vercel-doorman sync --provider cloudflare` | Sync to Cloudflare specifically                      |
| `vercel-doorman download`                   | Import remote rules to local config (remote → local) |
| `vercel-doorman download --dry-run`         | Preview changes without modifying config             |
| `vercel-doorman validate`                   | Check syntax and health                              |
| `vercel-doorman validate --verbose`         | Detailed validation results                          |

### Advanced

| Command                                                   | Description                              |
| --------------------------------------------------------- | ---------------------------------------- |
| `vercel-doorman watch`                                    | Auto-sync on file changes (dev workflow) |
| `vercel-doorman backup`                                   | Create configuration backup              |
| `vercel-doorman backup --list`                            | List backups                             |
| `vercel-doorman backup --restore backup.json`             | Restore from backup                      |
| `vercel-doorman export --format markdown`                 | Export as Markdown docs                  |
| `vercel-doorman export --format json`                     | Export as JSON                           |
| `vercel-doorman export --format yaml`                     | Export as YAML                           |
| `vercel-doorman export --format terraform`                | Export as Terraform                      |
| `vercel-doorman template`                                 | Browse available templates               |
| `vercel-doorman template ai-bots`                         | Add AI bot protection template           |
| `vercel-doorman template wordpress`                       | Add WordPress protection                 |
| `vercel-doorman template bad-bots`                        | Block malicious bots                     |
| `vercel-doorman template block-ofac-sanctioned-countries` | OFAC compliance                          |

## Workflows

### Development

```bash
vercel-doorman watch              # auto-sync on file changes
# or manual:
vercel-doorman status             # check what needs syncing
vercel-doorman diff               # review changes
vercel-doorman sync               # deploy
```

### Production Deployment

```bash
vercel-doorman backup             # safety first
vercel-doorman validate           # check syntax
vercel-doorman diff               # review changes
vercel-doorman sync               # deploy
vercel-doorman status             # verify
```

### CI/CD Integration

```yaml
# GitHub Actions example
- run: npm install -g vercel-doorman
- run: vercel-doorman validate
- run: vercel-doorman sync
  env:
    VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
    VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
    VERCEL_TEAM_ID: ${{ secrets.VERCEL_TEAM_ID }}
```

### Package.json Scripts

```json
{
  "scripts": {
    "firewall:list": "vercel-doorman list",
    "firewall:download": "vercel-doorman download",
    "firewall:sync": "vercel-doorman sync",
    "firewall:validate": "vercel-doorman validate"
  }
}
```

## Multi-Provider Support

Doorman 2.0 supports both Vercel Firewall and Cloudflare WAF through a unified interface.

### Provider Detection

Provider is auto-detected in this priority order:

1. `--provider` CLI flag
2. `provider` field in config
3. `providers.cloudflare.zoneId` in config → Cloudflare
4. `projectId` in config → Vercel (legacy format)
5. `DOORMAN_PROVIDER` env var
6. `CLOUDFLARE_ZONE_ID` env var → Cloudflare
7. `VERCEL_PROJECT_ID` env var → Vercel
8. Default: Vercel

### Cloudflare-Specific Features

- **Lists API** — efficient bulk IP management (requires `accountId`)
- **Managed challenges** — Cloudflare's advanced challenge types
- **Rule translation** — automatic translation between Vercel and Cloudflare formats
- **Expression building** — generates Cloudflare wirefilter expressions from conditions

### Feature Compatibility

| Feature                | Vercel | Cloudflare     |
| ---------------------- | ------ | -------------- |
| Custom rules           | ✅     | ✅             |
| IP blocking            | ✅     | ✅ (Lists API) |
| Rate limiting          | ✅     | ✅             |
| Geo-blocking           | ✅     | ✅             |
| Challenge              | ✅     | ✅ (managed)   |
| Redirect               | ✅     | ✅             |
| Regex matching         | ✅     | ⚠️ Enterprise  |
| Environment conditions | ✅     | ❌             |
| JA3/JA4 fingerprints   | ✅     | ❌             |

## Configuration Health

`vercel-doorman status` includes a health score:

- 🟢 80-100: Excellent
- 🟡 60-79: Good with minor improvements
- 🔴 0-59: Needs attention

Factors: rule naming, security best practices, performance impact (regex usage), maintainability (disabled rules, duplicates), provider-specific limits.

## Common Rule Examples

### Block by path prefix

```json
{
  "name": "Block Admin Access",
  "conditionGroup": [{ "conditions": [{ "type": "path", "op": "pre", "value": "/admin" }] }],
  "action": { "mitigate": { "action": "deny" } },
  "active": true
}
```

### Rate limit API

```json
{
  "name": "Rate Limit API",
  "conditionGroup": [{ "conditions": [{ "type": "path", "op": "pre", "value": "/api" }] }],
  "action": { "mitigate": { "action": "rate_limit", "rateLimit": { "requests": 100, "window": "60s" } } },
  "active": true
}
```

### Block by user agent

```json
{
  "name": "Block Bots",
  "conditionGroup": [{ "conditions": [{ "type": "user_agent", "op": "sub", "value": "bot" }] }],
  "action": { "mitigate": { "action": "deny" } },
  "active": true
}
```

### Geo-blocking

```json
{
  "name": "Block Countries",
  "conditionGroup": [{ "conditions": [{ "type": "geo_country", "op": "inc", "value": ["CN", "RU", "KP"] }] }],
  "action": { "mitigate": { "action": "deny" } },
  "active": true
}
```

### IP blocking

```json
{
  "ips": [{ "ip": "192.168.1.100/32", "hostname": "suspicious", "action": "deny", "notes": "Blocked for abuse" }]
}
```

## Security Best Practices

- Store API tokens in environment variables, never in code
- Test rules in staging before production
- Keep backups of working configurations (`vercel-doorman backup`)
- Start rules as `"active": false`, enable after testing
- Use descriptive names and descriptions for all rules
- Regularly rotate API tokens
- Use CIDR notation for IP rules (`/32` for single IPs)

## Troubleshooting

- "Project not found": verify Project ID, token access, and Pro plan or higher
- "Unauthorized": confirm `VERCEL_TOKEN` or `CLOUDFLARE_API_TOKEN` is set and not expired
- "Zone not found": verify `CLOUDFLARE_ZONE_ID` and token has zone access
- "Account ID required": provide `CLOUDFLARE_ACCOUNT_ID` for Lists API features
- Sync issues: run `status` → `diff` → `validate` to diagnose

## Resources

- [Documentation](https://doorman.griffen.codes/docs)
- [GitHub](https://github.com/gfargo/vercel-doorman)
- [GitHub Wiki](https://github.com/gfargo/vercel-doorman/wiki)
- [npm Package](https://www.npmjs.com/package/vercel-doorman)
- [Example Configurations](https://github.com/gfargo/vercel-doorman/tree/main/examples)
- [Vercel Firewall Docs](https://vercel.com/docs/security/vercel-firewall)
- [Cloudflare WAF Docs](https://developers.cloudflare.com/waf/)
