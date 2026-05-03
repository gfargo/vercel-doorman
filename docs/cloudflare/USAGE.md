# Cloudflare Usage Guide

Complete guide for using Vercel Doorman with Cloudflare WAF in production environments. Cloudflare support is now production-ready with comprehensive error handling, validation, and documentation.

## Prerequisites

- Cloudflare API Token (with permissions to manage Rulesets and Lists)
- Zone ID for the target domain
- Optional: Account ID to enable Cloudflare Lists for bulk IP management

## Environment Variables

```bash
export CLOUDFLARE_API_TOKEN="cf_api_token"   # Required
export CLOUDFLARE_ZONE_ID="zone_123"        # Required
export CLOUDFLARE_ACCOUNT_ID="acct_456"     # Optional (enables Lists)
```

## Initialize Configuration

Interactive initialization for Cloudflare:

```bash
vercel-doorman init --provider cloudflare --interactive
```

This creates a unified configuration with `provider: "cloudflare"`. You can also set provider details directly in the config:

```jsonc
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "zone_123",
      "accountId": "acct_456", // optional
    },
  },
  "rules": [
    // unified rules here
  ],
  "ips": [
    // optional IP rules (uses Lists when accountId is provided)
  ],
}
```

## Running Commands

Use the `--provider cloudflare` flag or set `provider: "cloudflare"` in your config:

```bash
vercel-doorman status --provider cloudflare
vercel-doorman diff --provider cloudflare
vercel-doorman sync --provider cloudflare
```

## IP Management

- With `CLOUDFLARE_ACCOUNT_ID` (or `providers.cloudflare.accountId`), Doorman uses Cloudflare Lists to manage IPs in bulk.
- Without an account ID, Doorman falls back to individual IP rules.

## Features & Capabilities

- **Complete WAF Integration**: Full support for custom rules, rate limiting, and IP blocking
- **Advanced Error Handling**: Comprehensive error messages with actionable suggestions
- **Lists API Support**: Efficient bulk IP management when Account ID is provided
- **Rule Translation**: Automatic translation between Vercel and Cloudflare formats with warnings
- **Production Ready**: Extensive testing, validation, and reliability improvements

## Troubleshooting

### Common Issues

- **"Cloudflare credentials missing"** → Ensure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ZONE_ID` are set
- **"Invalid API token"** → Verify token permissions include Zone:Firewall Services:Edit
- **"Zone not found"** → Check Zone ID is correct and token has access to the zone
- **Lists API errors** → Provide `CLOUDFLARE_ACCOUNT_ID` or proceed without Lists (individual IP rules)
- **Rules not syncing** → Check for validation errors and rule translation warnings

### Diagnostic Commands

```bash
# Check overall status and connectivity
vercel-doorman status --provider cloudflare

# Validate configuration syntax
vercel-doorman validate

# Test API connectivity
vercel-doorman health --provider cloudflare

# Preview changes before deployment
vercel-doorman diff --provider cloudflare
```

For detailed troubleshooting, see the [Troubleshooting Guide](troubleshooting.md).
