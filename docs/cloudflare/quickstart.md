# Cloudflare Quick Start Guide

Get up and running with Vercel Doorman and Cloudflare WAF in under 5 minutes.

## Prerequisites

- Cloudflare account with at least one domain
- Node.js 18+ installed
- Basic command line familiarity

## Step 1: Install Doorman

```bash
npm install -g vercel-doorman
```

## Step 2: Get Your Cloudflare Credentials

### API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Click "Create Token" → "Custom token"
3. Set these permissions:
   - **Zone:Firewall Services:Edit**
   - **Zone:Zone Settings:Read**
   - **Account:Account Rulesets:Edit** (optional, for Lists API)
4. Set zone resources to your domain
5. Click "Continue to summary" → "Create Token"
6. **Copy the token immediately** (you won't see it again!)

### Zone ID

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Scroll down on the Overview page
4. Copy the "Zone ID" from the right sidebar

### Account ID (Optional)

1. On any Cloudflare dashboard page
2. Look for "Account ID" in the right sidebar
3. Copy the Account ID

## Step 3: Set Environment Variables

```bash
export CLOUDFLARE_API_TOKEN="your_api_token_here"
export CLOUDFLARE_ZONE_ID="your_zone_id_here"
export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"  # Optional
```

## Step 4: Initialize Configuration

```bash
vercel-doorman init --provider cloudflare --interactive
```

This will:
- Test your credentials
- Create a configuration file
- Guide you through basic setup

## Step 5: Add Your First Rule

Let's add a simple bot blocking rule:

```bash
vercel-doorman template add bad-bots --provider cloudflare
```

Or manually edit your `vercel-firewall.config.json`:

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
      "id": "block_bad_bots",
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
  ]
}
```

## Step 6: Deploy Your Rules

```bash
# Check what will be deployed
vercel-doorman diff --provider cloudflare

# Deploy the rules
vercel-doorman sync --provider cloudflare
```

## Step 7: Verify Deployment

```bash
# Check status
vercel-doorman status --provider cloudflare

# List deployed rules
vercel-doorman list --provider cloudflare
```

You should see output like:
```
✅ Cloudflare connection successful
✅ Zone access verified
✅ 1 rule deployed successfully
✅ Configuration is healthy
```

## Next Steps

### Add More Security Rules

```bash
# Block AI bots
vercel-doorman template add ai-bots --provider cloudflare

# Add geo-blocking
vercel-doorman template add block-ofac-sanctioned-countries --provider cloudflare

# Add WordPress protection
vercel-doorman template add wordpress --provider cloudflare
```

### Set Up IP Blocking

Add IPs to your configuration:

```json
{
  "ips": [
    {
      "ip": "192.168.1.100/32",
      "hostname": "suspicious-host",
      "action": "deny",
      "notes": "Blocked due to suspicious activity"
    }
  ]
}
```

Then sync:
```bash
vercel-doorman sync --provider cloudflare
```

### Monitor Your Rules

Check Cloudflare Analytics:
1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Go to Security → Events
4. View rule triggers and blocked requests

### Development Workflow

For active development, use watch mode:

```bash
vercel-doorman watch --provider cloudflare
```

This automatically syncs changes when you modify your config file.

## Common Commands

```bash
# Check status
vercel-doorman status --provider cloudflare

# Preview changes
vercel-doorman diff --provider cloudflare

# Deploy changes
vercel-doorman sync --provider cloudflare

# List current rules
vercel-doorman list --provider cloudflare

# Validate configuration
vercel-doorman validate

# Create backup
vercel-doorman backup create --name "before-changes"

# Export documentation
vercel-doorman export --format markdown --output firewall-docs.md
```

## Troubleshooting

### "Invalid API Token" Error

- Verify token is correct and hasn't expired
- Check token permissions include Firewall Services:Edit
- Ensure token has access to your zone

### "Zone Not Found" Error

- Verify Zone ID is correct
- Check token has access to the zone
- Ensure zone is active in Cloudflare

### Rules Not Appearing

- Check Cloudflare Dashboard → Security → WAF → Custom rules
- Verify sync completed successfully
- Check for validation errors

### Need Help?

- **Setup Issues**: See [Setup Guide](setup.md)
- **Migration**: See [Migration Guide](migration.md)  
- **Troubleshooting**: See [Troubleshooting Guide](troubleshooting.md)
- **Feature Comparison**: See [Comparison Guide](comparison.md)

## Security Best Practices

1. **Test First**: Always test rules in staging before production
2. **Start Disabled**: Create rules disabled, enable after testing
3. **Monitor Analytics**: Check Cloudflare Analytics for rule effectiveness
4. **Regular Backups**: Create backups before major changes
5. **Version Control**: Keep configuration files in git

## What's Next?

- Explore advanced Cloudflare features like bot management
- Set up automated deployments with CI/CD
- Configure monitoring and alerting
- Consider migrating from other providers

Congratulations! You now have Cloudflare WAF managed as code with Vercel Doorman. 🎉