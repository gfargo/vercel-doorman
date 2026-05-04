# Cloudflare Troubleshooting Guide

Common issues and solutions when using Vercel Doorman with Cloudflare WAF.

## Quick Diagnostics

Run these commands to quickly diagnose issues:

```bash
# Check overall status
vercel-doorman status --provider cloudflare

# Validate configuration
vercel-doorman validate

# Test connectivity
vercel-doorman health --provider cloudflare

# Check for differences
vercel-doorman diff --provider cloudflare
```

## Authentication & Credentials

### Issue: "Invalid API Token" Error

**Error Message:**
```
❌ Cloudflare authentication failed: Invalid API token
```

**Possible Causes:**
- Incorrect API token
- Token has expired
- Token lacks required permissions

**Solutions:**

1. **Verify Token Format**
   ```bash
   # Token should start with "cf_" and be 40 characters
   echo $CLOUDFLARE_API_TOKEN | wc -c  # Should output 41 (including newline)
   ```

2. **Test Token Manually**
   ```bash
   curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json"
   ```

3. **Check Token Permissions**
   - Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
   - Verify token has `Zone:Firewall Services:Edit` permission
   - Ensure token hasn't expired

4. **Regenerate Token**
   - Create a new token with correct permissions
   - Update environment variables
   - Test with new token

### Issue: "Zone Not Found" Error

**Error Message:**
```
❌ Zone not found or access denied: zone_abc123
```

**Possible Causes:**
- Incorrect Zone ID
- Token doesn't have access to the zone
- Zone is paused or deleted

**Solutions:**

1. **Verify Zone ID**
   ```bash
   # List all zones accessible with your token
   curl -X GET "https://api.cloudflare.com/client/v4/zones" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result[] | {name, id}'
   ```

2. **Check Zone Status**
   ```bash
   # Check specific zone status
   curl -X GET "https://api.cloudflare.com/client/v4/zones/$CLOUDFLARE_ZONE_ID" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result.status'
   ```

3. **Update Token Permissions**
   - Ensure token includes the correct zone in "Zone Resources"
   - For multiple zones, use "All zones from an account"

### Issue: "Account ID Required" Warning

**Warning Message:**
```
⚠️  Account ID not provided - Lists API unavailable, using individual IP rules
```

**Impact:**
- IP blocking will use individual rules instead of efficient Lists
- May hit rule limits with many IPs

**Solutions:**

1. **Find Account ID**
   ```bash
   curl -X GET "https://api.cloudflare.com/client/v4/accounts" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result[] | {name, id}'
   ```

2. **Add Account ID**
   ```bash
   export CLOUDFLARE_ACCOUNT_ID="your_account_id"
   ```

3. **Update Configuration**
   ```json
   {
     "providers": {
       "cloudflare": {
         "zoneId": "your_zone_id",
         "accountId": "your_account_id"
       }
     }
   }
   ```

## Configuration Issues

### Issue: "Configuration Validation Failed"

**Error Message:**
```
❌ Configuration validation failed:
  - Rule 'example_rule': Invalid condition type 'invalid_type'
  - IP '999.999.999.999': Invalid IP address format
```

**Solutions:**

1. **Check Rule Structure**
   ```bash
   # Validate against schema
   vercel-doorman validate --verbose
   ```

2. **Fix Common Issues**
   - Ensure all required fields are present
   - Check IP address formats (use CIDR notation: `192.168.1.1/32`)
   - Verify condition types are supported
   - Check action types are valid

3. **Use Schema Validation**
   ```json
   {
     "$schema": "https://doorman.griffen.codes/schema.json"
   }
   ```

### Issue: Rules Not Syncing

**Symptoms:**
- `vercel-doorman sync` completes successfully
- Rules don't appear in Cloudflare dashboard
- No error messages

**Debugging Steps:**

1. **Check Sync Output**
   ```bash
   vercel-doorman sync --provider cloudflare --verbose
   ```

2. **Verify Rule Translation**
   ```bash
   vercel-doorman diff --provider cloudflare --verbose
   ```

3. **Check Cloudflare Dashboard**
   - Go to Security > WAF > Custom rules
   - Look for rules with names matching your configuration

**Common Causes:**

1. **Rule Translation Issues**
   - Complex conditions may not translate properly
   - Check for translation warnings in output

2. **Ruleset Issues**
   - Doorman creates a custom ruleset automatically
   - Check if ruleset was created successfully

3. **API Rate Limiting**
   - Too many requests may cause failures
   - Wait and retry

**Solutions:**

1. **Simplify Rules**
   ```json
   // Instead of complex nested conditions
   {
     "conditionGroup": [
       {
         "conditions": [
           { "type": "path", "op": "re", "value": "complex.*regex" },
           { "type": "method", "op": "eq", "value": "POST" }
         ]
       }
     ]
   }
   
   // Use simpler conditions
   {
     "conditionGroup": [
       {
         "conditions": [
           { "type": "path", "op": "sub", "value": "admin" },
           { "type": "method", "op": "eq", "value": "POST" }
         ]
       }
     ]
   }
   ```

2. **Check Rule Limits**
   - Free plan: 5 custom rules
   - Pro plan: 20 custom rules
   - Business plan: 100 custom rules
   - Enterprise: Unlimited

## Rate Limiting Issues

### Issue: Rate Limiting Not Working

**Symptoms:**
- Rate limiting rules are active
- Traffic is not being limited
- No rate limit triggers in analytics

**Debugging Steps:**

1. **Check Rule Conditions**
   ```bash
   # Verify conditions match actual traffic
   vercel-doorman list --provider cloudflare --verbose
   ```

2. **Test Rate Limiting**
   ```bash
   # Generate test traffic
   for i in {1..10}; do curl -I https://your-domain.com/api/test; done
   ```

3. **Check Cloudflare Analytics**
   - Go to Security > Events
   - Look for rate limiting events

**Common Issues:**

1. **Incorrect Thresholds**
   ```json
   // Too high threshold
   {
     "action": {
       "mitigate": {
         "action": "rate_limit",
         "rateLimit": {
           "requests": 10000,  // Too high
           "window": "60s"
         }
       }
     }
   }
   
   // Better threshold
   {
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
   ```

2. **Wrong Conditions**
   - Conditions don't match actual traffic patterns
   - Path patterns are too specific

3. **Rule Priority**
   - Other rules may be blocking traffic before rate limiting applies

### Issue: Rate Limiting Too Aggressive

**Symptoms:**
- Legitimate users being rate limited
- High false positive rate

**Solutions:**

1. **Adjust Thresholds**
   ```json
   {
     "rateLimit": {
       "requests": 200,     // Increase from 100
       "window": "60s"
     }
   }
   ```

2. **Refine Conditions**
   ```json
   // Add more specific conditions
   {
     "conditionGroup": [
       {
         "conditions": [
           { "type": "path", "op": "pre", "value": "/api/" },
           { "type": "method", "op": "eq", "value": "POST" }  // Only POST requests
         ]
       }
     ]
   }
   ```

3. **Use Challenge Instead of Block**
   ```json
   {
     "action": {
       "mitigate": {
         "action": "challenge"  // Instead of "deny"
       }
     }
   }
   ```

## IP Blocking Issues

### Issue: IP Blocking Not Effective

**Symptoms:**
- Blocked IPs still accessing the site
- IP rules appear in configuration but don't work

**Debugging Steps:**

1. **Check IP Format**
   ```bash
   # Verify IP addresses are valid
   vercel-doorman validate --verbose
   ```

2. **Check Lists API Status**
   ```bash
   vercel-doorman status --provider cloudflare
   ```

3. **Verify in Cloudflare Dashboard**
   - Go to Security > WAF > Tools
   - Check IP Access Rules or Lists

**Common Issues:**

1. **Incorrect IP Format**
   ```json
   // Wrong - missing CIDR notation
   {
     "ips": [
       { "ip": "192.168.1.1", "action": "deny" }
     ]
   }
   
   // Correct - with CIDR notation
   {
     "ips": [
       { "ip": "192.168.1.1/32", "action": "deny" }
     ]
   }
   ```

2. **Lists API Not Available**
   - Account ID not provided
   - Falls back to individual rules (less efficient)

3. **Rule Priority Issues**
   - Allow rules may override block rules
   - Check rule order in Cloudflare dashboard

**Solutions:**

1. **Use CIDR Notation**
   ```json
   {
     "ips": [
       { "ip": "192.168.1.1/32", "action": "deny" },      // Single IP
       { "ip": "192.168.1.0/24", "action": "deny" }       // IP range
     ]
   }
   ```

2. **Enable Lists API**
   ```bash
   export CLOUDFLARE_ACCOUNT_ID="your_account_id"
   ```

3. **Check Rule Priority**
   - Review all rules in Cloudflare dashboard
   - Ensure block rules have higher priority than allow rules

## Performance Issues

### Issue: Slow Sync Operations

**Symptoms:**
- `vercel-doorman sync` takes very long to complete
- Timeouts during sync operations

**Causes:**
- Large number of rules
- API rate limiting
- Network connectivity issues

**Solutions:**

1. **Enable Verbose Logging**
   ```bash
   vercel-doorman sync --provider cloudflare --verbose
   ```

2. **Reduce Rule Count**
   - Combine similar rules
   - Use more efficient conditions
   - Remove unused rules

3. **Use Batch Operations**
   ```bash
   # Sync in smaller batches
   vercel-doorman sync --provider cloudflare --batch-size 10
   ```

4. **Check Network Connectivity**
   ```bash
   # Test API connectivity
   curl -w "@curl-format.txt" -o /dev/null -s "https://api.cloudflare.com/client/v4/zones"
   ```

### Issue: API Rate Limiting

**Error Message:**
```
❌ Rate limit exceeded (429): Too Many Requests
```

**Solutions:**

1. **Wait and Retry**
   ```bash
   # Wait 60 seconds and retry
   sleep 60 && vercel-doorman sync --provider cloudflare
   ```

2. **Use Built-in Retry**
   ```bash
   vercel-doorman sync --provider cloudflare --retry 3
   ```

3. **Reduce Request Frequency**
   - Avoid running multiple sync operations simultaneously
   - Use `--batch-size` to reduce concurrent requests

## Rule Translation Issues

### Issue: Complex Rules Not Translating

**Warning Message:**
```
⚠️  Rule 'complex_rule' simplified: Regex patterns not fully supported
```

**Impact:**
- Rule behavior may change
- Security effectiveness may be reduced

**Solutions:**

1. **Review Translation Warnings**
   ```bash
   vercel-doorman diff --provider cloudflare --show-warnings
   ```

2. **Simplify Complex Rules**
   ```json
   // Instead of complex regex
   {
     "conditions": [
       { "type": "path", "op": "re", "value": "\\.(php|asp|jsp)$" }
     ]
   }
   
   // Use multiple simple conditions
   {
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
       }
     ]
   }
   ```

3. **Use Cloudflare-Specific Features**
   ```json
   // Leverage Cloudflare's advanced matching
   {
     "conditions": [
       { "type": "cf_threat_score", "op": "gt", "value": 10 }
     ]
   }
   ```

### Issue: Environment-Based Rules Removed

**Warning Message:**
```
⚠️  Rule 'env_rule' modified: Environment conditions removed (not supported by Cloudflare)
```

**Solutions:**

1. **Use Separate Configurations**
   ```bash
   # Production config
   vercel-doorman sync --config production.config.json --provider cloudflare
   
   # Staging config
   vercel-doorman sync --config staging.config.json --provider cloudflare
   ```

2. **Use Zone-Based Separation**
   - Create separate zones for different environments
   - Use different Zone IDs in configuration

## Monitoring and Debugging

### Enable Debug Logging

```bash
# Enable debug mode
export DEBUG=vercel-doorman:*
vercel-doorman sync --provider cloudflare

# Or use verbose flag
vercel-doorman sync --provider cloudflare --verbose --debug
```

### Check Cloudflare Analytics

1. **Security Events**
   - Go to Security > Events
   - Filter by rule name or action
   - Check for unexpected triggers

2. **Traffic Analytics**
   - Go to Analytics & Logs > Traffic
   - Look for blocked/challenged requests
   - Verify rule effectiveness

### Log Analysis

```bash
# Check recent sync logs
vercel-doorman logs --provider cloudflare --recent

# Export logs for analysis
vercel-doorman logs --provider cloudflare --export logs.json
```

## Getting Additional Help

### Before Seeking Help

1. **Gather Information**
   ```bash
   # System information
   vercel-doorman --version
   node --version
   
   # Configuration status
   vercel-doorman status --provider cloudflare --verbose
   
   # Recent logs
   vercel-doorman logs --recent
   ```

2. **Create Minimal Reproduction**
   - Simplify configuration to minimal failing case
   - Document exact steps to reproduce
   - Include error messages and logs

### Support Channels

- **Documentation**: [docs.doorman.griffen.codes](https://docs.doorman.griffen.codes)
- **GitHub Issues**: [Report bugs and feature requests](https://github.com/gfargo/vercel-doorman/issues)
- **Cloudflare Community**: [community.cloudflare.com](https://community.cloudflare.com/)
- **Cloudflare Support**: For Cloudflare-specific API issues

### Professional Support

For complex issues or enterprise deployments:
- Migration consulting
- Custom rule development
- Performance optimization
- Training and best practices

## Prevention Tips

### Best Practices

1. **Regular Backups**
   ```bash
   # Create weekly backups
   vercel-doorman backup create --name "weekly-$(date +%Y%m%d)"
   ```

2. **Test Before Production**
   ```bash
   # Always test in staging first
   vercel-doorman sync --config staging.config.json --provider cloudflare
   ```

3. **Monitor Rule Effectiveness**
   - Regular review of Cloudflare Analytics
   - Check for false positives
   - Adjust rules based on traffic patterns

4. **Keep Documentation Updated**
   - Document custom rules and their purposes
   - Maintain change logs
   - Update team procedures

5. **Version Control**
   ```bash
   # Keep configurations in git
   git add vercel-firewall.config.json
   git commit -m "Update firewall rules"
   ```

### Health Checks

Set up regular health checks:

```bash
#!/bin/bash
# health-check.sh

echo "Checking Cloudflare firewall health..."

# Check status
if ! vercel-doorman status --provider cloudflare --quiet; then
    echo "❌ Status check failed"
    exit 1
fi

# Validate configuration
if ! vercel-doorman validate --quiet; then
    echo "❌ Configuration validation failed"
    exit 1
fi

# Check for drift
if vercel-doorman diff --provider cloudflare --quiet | grep -q "Changes detected"; then
    echo "⚠️  Configuration drift detected"
    # Optionally auto-sync or alert
fi

echo "✅ Health check passed"
```

Run this script regularly via cron or CI/CD pipeline to catch issues early.