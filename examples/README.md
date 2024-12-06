# Examples & Getting Started

This directory contains example configurations and templates to help you get started with Vercel Doorman. Whether you're looking to use pre-built templates or create custom rules, you'll find everything you need here.

## Quick Start with Templates

The fastest way to get started is by using our built-in templates based on Vercel's official rule templates. Use the `template` command to add pre-configured rules to your configuration:

```bash
# List available templates
vercel-doorman template

# Add a specific template
vercel-doorman template wordpress    # Block WordPress-related URLs
vercel-doorman template ai-bots      # Block AI bot traffic
vercel-doorman template bad-bots     # Block known malicious bots
```

### Available Templates

- **Block Bad Bots** (`bad-bots`): Protect against common malicious bot traffic
- **Block AI Bots** (`ai-bots`): Prevent AI crawlers and scrapers
- **Block WordPress URLs** (`wordpress`): Deny access to common WordPress paths
- **Block OFAC Countries** (`block-ofac-sanctioned-countries`): Comply with OFAC sanctions

## Rule Structure

Each firewall rule in Vercel Doorman follows this structure:

```json
{
  "name": "Example Rule",
  "description": "Optional description of the rule",
  "conditionGroup": [
    {
      "conditions": [
        {
          "type": "path",
          "op": "pre",
          "value": "/api"
        }
      ]
    }
  ],
  "action": {
    "mitigate": {
      "action": "deny",
      "rateLimit": {
        "requests": 100,
        "window": "1m"
      },
      "actionDuration": "1h"
    }
  },
  "active": true
}
```

### Key Components

1. **Condition Groups**: Define when rules should trigger
   - Multiple conditions in a group use AND logic
   - Multiple groups use OR logic
2. **Conditions**: Specify matching criteria
   - `path`: URL path matching
   - `ip`: IP address filtering
   - `country`: Geographic restrictions
   - `method`: HTTP method filtering
   - `header`: Custom header matching
3. **Actions**: Define the response
   - `deny`: Block the request
   - `challenge`: Present a browser challenge
   - `rateLimit`: Limit request frequency
   - `rewrite`: Modify the request
4. **Metadata**: Rule information
   - `name`: Unique identifier
   - `description`: Optional explanation
   - `active`: Enable/disable the rule

## Example Categories

### Basic Protection

- `ip-block.json` - Block specific IP addresses
- `path-protection.json` - Secure specific URL paths
- `geo-blocking.json` - Country-based access control
- `method-restriction.json` - Limit HTTP methods

### Advanced Security

- `rate-limiting.json` - Prevent abuse through rate limits
- `redirect-rules.json` - Traffic redirection examples
- `challenge-rules.json` - Bot prevention with challenges
- `conditional-rules.json` - Complex rule combinations

### Specialized Rules

- `user-agent-filtering.json` - Filter by browser/client type
- `header-based-rules.json` - Rules based on HTTP headers
- `mixed-rules.json` - Multiple protection layers

## Best Practices

1. **Start Simple**: Begin with basic rules and expand as needed
2. **Test First**: Use `--dry-run` when syncing new rules
3. **Monitor Impact**: Review logs after implementing new rules
4. **Layer Security**: Combine multiple rules for better protection
5. **Version Control**: Keep your config file in source control
