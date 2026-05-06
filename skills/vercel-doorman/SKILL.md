---
name: vercel-doorman
description: "Use when managing Vercel or Cloudflare WAF rules as code, configuring firewall rules, IP blocking, rate limiting, bot protection, or automating multi-provider security configuration deployment with Doorman CLI."
---

# Vercel Doorman

Multi-provider WAF automation as code. Manage Vercel Firewall and Cloudflare WAF rules in version-controlled `.doorman.json` files with automated deployment via CLI.

## Key Concepts

- **Config file**: `.doorman.json` (also supports legacy `vercel-firewall.config.json`)
- **Providers**: Vercel (default) and Cloudflare (`--provider cloudflare`)
- **Workflow**: Edit config → validate → diff → sync
- **Schema**: `https://doorman.griffen.codes/schema.json`

## Commands

```bash
vercel-doorman init --interactive       # Create new config
vercel-doorman validate                 # Check config syntax
vercel-doorman status                   # Sync status + health score
vercel-doorman list                     # Show deployed rules
vercel-doorman diff                     # Local vs remote differences
vercel-doorman sync                     # Deploy local config to provider
vercel-doorman download                 # Pull remote rules to local config
vercel-doorman template <name>          # Add pre-built rule template
vercel-doorman watch                    # Auto-sync on file changes
vercel-doorman backup                   # Create config backup
vercel-doorman export --format <fmt>    # Export as markdown|json|yaml|terraform
```

All commands accept `--provider vercel|cloudflare` and `--config <path>`.

## Environment Variables

```bash
# Vercel
VERCEL_TOKEN=your_token
VERCEL_PROJECT_ID=prj_xxx
VERCEL_TEAM_ID=team_xxx

# Cloudflare
CLOUDFLARE_API_TOKEN=your_token
CLOUDFLARE_ZONE_ID=zone_xxx
CLOUDFLARE_ACCOUNT_ID=acc_xxx  # optional, enables Lists API
```

## Config Structure

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "projectId": "prj_xxx",
  "teamId": "team_xxx",
  "rules": [],
  "ips": []
}
```

For Cloudflare, use `provider` and `providers` fields instead of `projectId`/`teamId`.

## Rule Quick Reference

```json
{
  "id": "rule_block_admin",
  "name": "Block Admin Access",
  "description": "Block unauthorized admin access",
  "active": true,
  "conditionGroup": [
    {
      "conditions": [
        { "type": "path", "op": "pre", "value": "/admin" },
        { "type": "method", "op": "eq", "value": "POST" }
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

**Logic**: Conditions within a group are AND'd. Multiple groups are OR'd.

**Condition types**: `path`, `method`, `host`, `user_agent`, `ip_address`, `header`, `query`, `cookie`, `geo_country`, `geo_city`, `geo_continent`, `scheme`

**Operators**: `eq`, `pre` (starts_with), `suf` (ends_with), `sub` (contains), `inc` (in array), `re` (regex), `ex` (exists), `nex` (not exists)

**Actions**: `deny`, `challenge`, `rate_limit`, `redirect`, `log`, `bypass`

**See `rules-reference.md` for complete field documentation, advanced patterns, and examples.**

## IP Blocking

```json
{
  "ips": [
    { "ip": "192.168.1.0/24", "action": "deny", "hostname": "bad-subnet", "notes": "Blocked for abuse" }
  ]
}
```

## Templates

```bash
vercel-doorman template bad-bots       # Block malicious bots
vercel-doorman template ai-bots        # Block AI crawlers
vercel-doorman template wordpress      # Block WordPress attack paths
vercel-doorman template block-ofac-sanctioned-countries  # OFAC compliance
```

## Workflow

```bash
# Add a rule: edit .doorman.json, then:
vercel-doorman validate && vercel-doorman sync

# Pull existing rules from provider:
vercel-doorman download

# Check what would change before deploying:
vercel-doorman diff
```

## Resources

- [Docs](https://doorman.griffen.codes/docs)
- [GitHub](https://github.com/gfargo/vercel-doorman)
- [Wiki](https://github.com/gfargo/vercel-doorman/wiki)
- [Examples](https://github.com/gfargo/vercel-doorman/tree/main/examples)
