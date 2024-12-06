# Examples

This directory contains example configurations demonstrating different firewall rule variations and settings.

## Rule Structure

Each rule in Vercel Doorman follows the Vercel Firewall API structure:

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

### Key Components:

1. **Condition Groups**: Arrays of condition sets that determine when the rule applies
2. **Conditions**: Individual criteria like path, IP, or headers
3. **Actions**: What happens when conditions are met (deny, challenge, rate limit, etc.)
4. **Metadata**: Name, description, and active status

## Categories

### Basic Rules

- `ip-block.json` - Basic IP address blocking
- `path-protection.json` - Path-based access control
- `geo-blocking.json` - Geographic location based rules
- `method-restriction.json` - HTTP method restrictions

### Advanced Rules

- `rate-limiting.json` - Rate limiting examples
- `redirect-rules.json` - Redirection configurations
- `challenge-rules.json` - Browser challenge examples
- `conditional-rules.json` - Complex condition group examples

### Special Cases

- `user-agent-filtering.json` - User agent based rules
- `header-based-rules.json` - Custom header based rules
- `mixed-rules.json` - Combining multiple rule types
