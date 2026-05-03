# Cloudflare Setup Guide

Complete step-by-step guide for setting up Vercel Doorman with Cloudflare WAF.

## Prerequisites

Before you begin, ensure you have:

- A Cloudflare account with at least one domain added
- Node.js 18+ installed
- Basic familiarity with command line tools

## Step 1: Install Vercel Doorman

Install the CLI tool globally:

```bash
npm install -g vercel-doorman
```

Or use with npx (no installation required):

```bash
npx vercel-doorman --help
```

## Step 2: Obtain Cloudflare API Token

### Creating an API Token

1. **Log in to Cloudflare Dashboard**
   - Visit [dash.cloudflare.com](https://dash.cloudflare.com)
   - Sign in to your account

2. **Navigate to API Tokens**
   - Click on your profile icon (top right)
   - Select "My Profile"
   - Go to the "API Tokens" tab
   - Click "Create Token"

3. **Configure Token Permissions**
   - Select "Custom token"
   - Set the following permissions:

   | Permission Type | Permission | Access Level |
   |----------------|------------|--------------|
   | Zone | Zone Settings | Read |
   | Zone | Zone | Read |
   | Zone | Firewall Services | Edit |
   | Account | Account Rulesets | Edit (Optional) |

4. **Set Zone Resources**
   - **For single zone**: Include → Specific zone → [your-domain.com]
   - **For multiple zones**: Include → All zones from an account

5. **Optional Security Settings**
   - **Client IP Address Filtering**: Add your IP for extra security
   - **TTL**: Set token expiration (recommended: 1 year)

6. **Create and Copy Token**
   - Click "Continue to summary"
   - Click "Create Token"
   - **Important**: Copy the token immediately - you won't see it again!

### Required Permissions Explained

- **Zone Settings (Read)**: Allows reading zone configuration
- **Zone (Read)**: Allows reading zone information and status
- **Firewall Services (Edit)**: Required for managing WAF rules and rulesets
- **Account Rulesets (Edit)**: Optional, enables account-level rules and Lists API

## Step 3: Find Your Zone ID

### Method 1: Cloudflare Dashboard

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Select your domain
3. Scroll down on the Overview page
4. Find "Zone ID" in the right sidebar
5. Click to copy

### Method 2: Using API

```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.result[] | {name, id}'
```

## Step 4: Find Your Account ID (Optional)

The Account ID enables advanced features like Cloudflare Lists for bulk IP management.

### Method 1: Cloudflare Dashboard

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Look in the right sidebar on any page
3. Find "Account ID" and copy it

### Method 2: Using API

```bash
curl -X GET "https://api.cloudflare.com/client/v4/accounts" \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.result[] | {name, id}'
```

## Step 5: Configure Environment Variables

Set up your credentials using environment variables:

### Option A: Export in Terminal

```bash
export CLOUDFLARE_API_TOKEN="your_api_token_here"
export CLOUDFLARE_ZONE_ID="your_zone_id_here"
export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"  # Optional
```

### Option B: Create .env File

Create a `.env` file in your project directory:

```bash
# .env
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ZONE_ID=your_zone_id_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here  # Optional
```

### Option C: Add to Shell Profile

For permanent setup, add to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.):

```bash
echo 'export CLOUDFLARE_API_TOKEN="your_api_token_here"' >> ~/.zshrc
echo 'export CLOUDFLARE_ZONE_ID="your_zone_id_here"' >> ~/.zshrc
echo 'export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"' >> ~/.zshrc
source ~/.zshrc
```

## Step 6: Initialize Configuration

### Interactive Setup

Run the interactive initialization:

```bash
vercel-doorman init --provider cloudflare --interactive
```

This will:
- Validate your credentials
- Test API connectivity
- Create a configuration file
- Guide you through basic setup

### Manual Configuration

Create a `vercel-firewall.config.json` file:

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "your_zone_id_here",
      "accountId": "your_account_id_here"
    }
  },
  "rules": [],
  "ips": []
}
```

## Step 7: Verify Setup

Test your configuration:

```bash
# Check connectivity and credentials
vercel-doorman status --provider cloudflare

# Validate configuration
vercel-doorman validate

# List current rules (should be empty initially)
vercel-doorman list --provider cloudflare
```

Expected output for a working setup:
```
✅ Cloudflare connection successful
✅ Zone access verified
✅ API token permissions valid
✅ Configuration file valid
ℹ️  Lists API available (Account ID provided)
```

## Configuration Examples

### Basic Security Rules

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
      "id": "block_admin_bots",
      "name": "Block Bots from Admin",
      "description": "Block bot traffic from admin paths",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "path",
              "op": "pre",
              "value": "/admin"
            },
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
      "action": "deny",
      "notes": "Blocked due to suspicious activity"
    }
  ]
}
```

### Rate Limiting Example

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "your_zone_id"
    }
  },
  "rules": [
    {
      "id": "api_rate_limit",
      "name": "API Rate Limiting",
      "description": "Limit API requests to 100 per minute",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "path",
              "op": "pre",
              "value": "/api/"
            }
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

### Geo-blocking Example

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "zoneId": "your_zone_id"
    }
  },
  "rules": [
    {
      "id": "block_countries",
      "name": "Block Specific Countries",
      "description": "Block traffic from specific countries",
      "active": true,
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "geo_country",
              "op": "inc",
              "value": ["CN", "RU", "KP"]
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

## Common Use Cases

### 1. WordPress Protection

```bash
# Add WordPress protection template
vercel-doorman template add wordpress --provider cloudflare
```

### 2. Bot Protection

```bash
# Add bot protection rules
vercel-doorman template add bad-bots --provider cloudflare
vercel-doorman template add ai-bots --provider cloudflare
```

### 3. API Security

```bash
# Create API-specific rules
vercel-doorman template add api-protection --provider cloudflare
```

## Next Steps

1. **Add Rules**: Start adding security rules to your configuration
2. **Test Changes**: Use `vercel-doorman diff` to preview changes
3. **Sync Rules**: Deploy rules with `vercel-doorman sync`
4. **Monitor**: Use `vercel-doorman status` to monitor rule health
5. **Backup**: Create backups with `vercel-doorman backup create`

## Advanced Configuration

### Multiple Zones

To manage multiple zones, create separate configuration files:

```bash
# Zone 1
vercel-doorman init --provider cloudflare --config zone1.config.json

# Zone 2  
vercel-doorman init --provider cloudflare --config zone2.config.json
```

### Account-Level Rules

With an Account ID, you can create account-level rules that apply to all zones:

```json
{
  "provider": "cloudflare",
  "providers": {
    "cloudflare": {
      "accountId": "your_account_id",
      "useAccountRules": true
    }
  }
}
```

### Lists API Integration

When Account ID is provided, Doorman automatically uses Cloudflare Lists for IP management:

```bash
# This will use Lists API if Account ID is configured
vercel-doorman sync --provider cloudflare
```

## Troubleshooting

See the [Troubleshooting Guide](troubleshooting.md) for common issues and solutions.

## Security Best Practices

1. **Token Security**
   - Never commit API tokens to version control
   - Use environment variables or secure secret management
   - Set token expiration dates
   - Restrict token IP access when possible

2. **Permissions**
   - Use minimum required permissions
   - Create separate tokens for different environments
   - Regularly audit and rotate tokens

3. **Configuration**
   - Keep configuration files in version control (without secrets)
   - Use separate configs for different environments
   - Regular backup your configurations

4. **Monitoring**
   - Regularly check rule effectiveness
   - Monitor for false positives
   - Review Cloudflare security events

## Support

- **Documentation**: [docs.doorman.griffen.codes](https://docs.doorman.griffen.codes)
- **Issues**: [GitHub Issues](https://github.com/gfargo/vercel-doorman/issues)
- **Cloudflare Docs**: [developers.cloudflare.com/waf](https://developers.cloudflare.com/waf/)