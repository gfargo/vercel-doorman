# Cloudflare WAF Technical Reference

> Comprehensive technical documentation for Cloudflare Web Application Firewall (WAF) integration into Vercel Doorman

---

## Table of Contents

1. [Overview](#overview)
2. [Key Concepts](#key-concepts)
3. [API Architecture](#api-architecture)
4. [Ruleset Engine](#ruleset-engine)
5. [Rule Structure](#rule-structure)
6. [Expression Language](#expression-language)
7. [Actions](#actions)
8. [Authentication](#authentication)
9. [Rate Limits](#rate-limits)
10. [Comparison: Cloudflare vs Vercel](#comparison-cloudflare-vs-vercel)
11. [Resources](#resources)

---

## Overview

### What is Cloudflare WAF?

Cloudflare Web Application Firewall (WAF) is a comprehensive security solution that protects websites and APIs by filtering incoming web traffic through configurable rule sets.

**Key Features:**

- 🛡️ Custom Rules - Create personalized protection strategies
- ⚡ Rate Limiting Rules - Control request frequency
- 🔒 Managed Rules - Pre-configured protection updated regularly
- 📊 Security Analytics - Event logging and threat intelligence
- 🌍 Available on all Cloudflare plans

**Core Differentiators:**

- Uses "wirefilter" syntax for rule matching (string-based expressions)
- Integrated with Cloudflare's global network
- Ruleset Engine provides unified rule management across products
- Enterprise-level account-wide configuration support

---

## Key Concepts

### 1. Rulesets

**Definition:** A collection of rules that execute in a specific phase of request processing.

**Ruleset Types (kinds):**

- `root` - Entry point ruleset for a phase
- `zone` - Zone-level ruleset
- `custom` - User-created custom ruleset
- `managed` - Cloudflare-managed ruleset (pre-configured)

**Properties:**

- `id` - Unique 32-character UUID
- `name` - Human-readable name
- `description` - Optional description
- `kind` - Ruleset type
- `phase` - Execution phase
- `version` - Incremental integer (starts at 1)
- `rules` - Array of rule objects
- `last_updated` - ISO 8601 timestamp

### 2. Phases

**Definition:** Execution stages in Cloudflare's request processing pipeline.

**Common Phases:**

- `http_request_firewall_custom` - Custom firewall rules
- `http_request_firewall_managed` - Managed rules
- `http_ratelimit` - Rate limiting rules
- `http_request_transform` - Request transformation
- `http_response_headers_transform` - Response header modification

### 3. Rules

**Definition:** Individual rule within a ruleset that defines matching criteria and actions.

**Properties:**

- `id` - Unique 32-character UUID
- `version` - Incremental integer
- `action` - Action to take when matched
- `expression` - Matching criteria (wirefilter syntax)
- `description` - Optional description
- `enabled` - Boolean indicating if rule is active
- `categories` - Optional tags/labels
- `last_updated` - ISO 8601 timestamp

### 4. Zones vs Accounts

**Zone:** Individual domain/website (e.g., example.com)

- Zone-level rules apply to a single domain
- Path: `/zones/{zone_id}/rulesets`

**Account:** Container for multiple zones

- Account-level rules can apply across multiple domains
- Path: `/accounts/{account_id}/rulesets`

---

## API Architecture

### Base URL

```
https://api.cloudflare.com/client/v4
```

### Authentication

```http
Authorization: Bearer {api_token}
Content-Type: application/json
```

### Ruleset Engine API Endpoints

#### List Rulesets

```http
GET /zones/{zone_id}/rulesets
GET /accounts/{account_id}/rulesets
```

**Response:**

```json
{
  "result": [
    {
      "id": "6a359df138c442b385d20140d4d96919",
      "name": "Custom WAF Rules",
      "kind": "custom",
      "phase": "http_request_firewall_custom",
      "version": "3",
      "rules": [...]
    }
  ],
  "success": true
}
```

#### Get Specific Ruleset

```http
GET /zones/{zone_id}/rulesets/{ruleset_id}
```

#### Create Ruleset

```http
POST /zones/{zone_id}/rulesets
```

**Request Body:**

```json
{
  "name": "My Custom Ruleset",
  "kind": "custom",
  "phase": "http_request_firewall_custom",
  "description": "Custom security rules",
  "rules": [
    {
      "action": "block",
      "expression": "ip.src in {192.0.2.0/24}",
      "description": "Block specific IP range",
      "enabled": true
    }
  ]
}
```

#### Update Ruleset (Creates New Version)

```http
PUT /zones/{zone_id}/rulesets/{ruleset_id}
```

**Note:** Updates create a new version. Include ALL rules in the request body.

#### Update Single Rule

```http
PATCH /zones/{zone_id}/rulesets/{ruleset_id}/rules/{rule_id}
```

**Request Body:**

```json
{
  "action": "managed_challenge",
  "enabled": false
}
```

#### Add Rule to Ruleset

```http
POST /zones/{zone_id}/rulesets/{ruleset_id}/rules
```

#### Delete Rule

```http
DELETE /zones/{zone_id}/rulesets/{ruleset_id}/rules/{rule_id}
```

#### Delete Ruleset

```http
DELETE /zones/{zone_id}/rulesets/{ruleset_id}
```

---

## Ruleset Engine

### Complete Ruleset JSON Structure

```json
{
  "id": "6a359df138c442b385d20140d4d96919",
  "name": "Example Custom Ruleset",
  "description": "Security rules for production",
  "kind": "custom",
  "version": "5",
  "phase": "http_request_firewall_custom",
  "rules": [
    {
      "id": "fdb0dd271f3f40b19679cc5d91396024",
      "version": "1",
      "action": "block",
      "expression": "(ip.geoip.country eq \"CN\") and (http.request.uri.path contains \"/admin\")",
      "description": "Block China access to admin",
      "enabled": true,
      "categories": ["security", "geo-blocking"]
    },
    {
      "id": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",
      "version": "2",
      "action": "managed_challenge",
      "expression": "cf.threat_score gt 10",
      "description": "Challenge suspicious traffic",
      "enabled": true
    }
  ],
  "last_updated": "2025-01-15T10:30:00Z"
}
```

### Versioning

- Every ruleset update creates a new version
- Version numbers increment automatically
- No way to roll back to previous versions via API (must recreate)
- Consider implementing backup/restore in Doorman

---

## Rule Structure

### Rule Object Properties

| Property       | Type    | Required       | Description                 |
| -------------- | ------- | -------------- | --------------------------- |
| `id`           | string  | Auto-generated | 32-char UUID                |
| `version`      | string  | Auto-generated | Incremental version         |
| `action`       | string  | Yes            | Action to perform           |
| `expression`   | string  | Yes            | Wirefilter expression       |
| `description`  | string  | No             | Human-readable description  |
| `enabled`      | boolean | No             | Rule status (default: true) |
| `categories`   | array   | No             | Tags for organization       |
| `last_updated` | string  | Auto-generated | ISO 8601 timestamp          |

### Rule Actions

| Action              | Description           | Availability |
| ------------------- | --------------------- | ------------ |
| `block`             | Block request         | All plans    |
| `challenge`         | CAPTCHA challenge     | All plans    |
| `managed_challenge` | Smart challenge       | All plans    |
| `js_challenge`      | JavaScript challenge  | All plans    |
| `log`               | Log only (no action)  | All plans    |
| `skip`              | Skip subsequent rules | All plans    |
| `allow`             | Explicitly allow      | All plans    |
| `rewrite`           | URL rewrite           | Enterprise   |
| `redirect`          | HTTP redirect         | All plans    |

### Action Configuration Objects

#### Block

```json
{
  "action": "block",
  "action_parameters": {
    "response": {
      "status_code": 403,
      "content": "Access Denied",
      "content_type": "text/plain"
    }
  }
}
```

#### Redirect

```json
{
  "action": "redirect",
  "action_parameters": {
    "from_value": {
      "status_code": 301,
      "target_url": {
        "value": "https://example.com/new-path"
      },
      "preserve_query_string": true
    }
  }
}
```

#### Rate Limit

```json
{
  "action": "block",
  "ratelimit": {
    "characteristics": ["ip.src", "cf.colo.id"],
    "period": 60,
    "requests_per_period": 100,
    "mitigation_timeout": 600,
    "counting_expression": ""
  }
}
```

---

## Expression Language

Cloudflare uses **wirefilter** syntax for rule expressions. This is a string-based expression language (unlike Vercel's structured JSON).

### Basic Syntax

#### Comparison Operators

- `eq` - Equals
- `ne` - Not equals
- `lt` - Less than
- `le` - Less than or equal
- `gt` - Greater than
- `ge` - Greater than or equal
- `contains` - String contains substring
- `matches` - Regex match (Enterprise only)
- `in` - Value in list/CIDR range

#### Logical Operators

- `and` - Logical AND
- `or` - Logical OR
- `not` - Logical NOT
- Parentheses for grouping: `(expression)`

### Common Fields

#### HTTP Request Fields

```
http.request.uri.path
http.request.uri.query
http.request.method
http.request.headers["header-name"]
http.request.body.raw
http.host
http.user_agent
http.referer
```

#### IP and Geo Fields

```
ip.src                    # Source IP address
ip.geoip.country          # Two-letter country code
ip.geoip.continent        # Continent code
ip.geoip.subdivision_1    # State/province
ip.geoip.city            # City name
ip.geoip.asnum           # AS number
```

#### Cloudflare Fields

```
cf.bot_management.score   # Bot score (0-100)
cf.threat_score          # Threat score (0-100)
cf.edge.server_port      # Cloudflare edge port
cf.tls_client_auth.cert_verified  # mTLS verification
cf.zone.name            # Zone name
```

#### SSL/TLS Fields

```
ssl                      # Boolean: is HTTPS
cf.tls_version          # TLS version
cf.tls_cipher           # Cipher suite
```

### Expression Examples

#### Simple Path Match

```
http.request.uri.path eq "/admin"
```

#### Path Prefix Match

```
starts_with(http.request.uri.path, "/api/")
```

#### Multiple Conditions (AND)

```
(ip.geoip.country eq "US") and (http.request.method eq "POST")
```

#### Multiple Conditions (OR)

```
(http.request.uri.path contains "/admin") or (http.request.uri.path contains "/login")
```

#### IP Range Blocking

```
ip.src in {192.168.1.0/24 10.0.0.0/8}
```

#### Country List

```
ip.geoip.country in {"CN" "RU" "KP"}
```

#### User Agent Matching

```
http.user_agent contains "bot"
```

#### Complex Expression

```
(
  ip.geoip.country in {"CN" "RU"} and
  http.request.uri.path contains "/admin"
) or (
  cf.threat_score gt 10 and
  http.request.method eq "POST"
)
```

#### Rate Limiting Expression

```
(http.request.uri.path eq "/api/login") and (http.request.method eq "POST")
```

#### Header Matching

```
any(http.request.headers["x-custom-header"][*] eq "forbidden-value")
```

#### Query Parameter Matching

```
http.request.uri.query contains "debug=true"
```

### Functions

| Function        | Description               | Example                                                        |
| --------------- | ------------------------- | -------------------------------------------------------------- |
| `starts_with()` | String starts with        | `starts_with(http.request.uri.path, "/api")`                   |
| `ends_with()`   | String ends with          | `ends_with(http.host, ".example.com")`                         |
| `contains()`    | String contains           | `contains(http.user_agent, "bot")`                             |
| `lower()`       | Convert to lowercase      | `lower(http.host) eq "example.com"`                            |
| `upper()`       | Convert to uppercase      | `upper(http.request.method) eq "GET"`                          |
| `len()`         | String/list length        | `len(http.request.uri.path) gt 1000`                           |
| `any()`         | Any array element matches | `any(http.request.headers["x-forwarded-for"][*] eq "1.1.1.1")` |
| `all()`         | All array elements match  | `all(http.request.headers.names[*] ne "x-bad-header")`         |

---

## Actions

### Action Types Detail

#### 1. Block

Immediately blocks the request and returns an error page.

```json
{
  "action": "block",
  "expression": "ip.src in {192.0.2.0/24}"
}
```

**Custom Response:**

```json
{
  "action": "block",
  "action_parameters": {
    "response": {
      "status_code": 403,
      "content": "Access Denied - Contact support@example.com",
      "content_type": "text/plain"
    }
  }
}
```

#### 2. Challenge (CAPTCHA)

Presents a CAPTCHA challenge to the visitor.

```json
{
  "action": "challenge",
  "expression": "cf.threat_score gt 10"
}
```

#### 3. Managed Challenge

Uses Cloudflare's intelligent challenge system (may not require user interaction).

```json
{
  "action": "managed_challenge",
  "expression": "cf.bot_management.score lt 30"
}
```

#### 4. JS Challenge

Requires JavaScript execution to verify client is a browser.

```json
{
  "action": "js_challenge",
  "expression": "http.user_agent contains \"curl\""
}
```

#### 5. Log

Records the request without taking action (monitoring).

```json
{
  "action": "log",
  "expression": "http.request.uri.path contains \"/test\""
}
```

#### 6. Skip

Skips specified products/phases for matched requests.

```json
{
  "action": "skip",
  "action_parameters": {
    "ruleset": "current",
    "phases": ["http_ratelimit"]
  },
  "expression": "ip.src in {203.0.113.0/24}"
}
```

#### 7. Allow

Explicitly allows the request (can bypass other rules).

```json
{
  "action": "allow",
  "expression": "ip.src in {198.51.100.0/24}"
}
```

---

## Authentication

### API Token Setup

1. **Visit:** [Cloudflare Dashboard > API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Click:** "Create Token"
3. **Select:** "Custom Token"
4. **Permissions:**
   - Zone > Firewall Services > Edit
   - Zone > Zone Settings > Read (optional, for zone info)
5. **Zone Resources:**
   - Include > Specific zone > [your-zone]
   - OR: Include > All zones (for account-wide)
6. **IP Filtering:** Optional (recommended for security)
7. **TTL:** Set expiration (optional)

### Token Scopes

**Required Permissions:**

```
Zone.Firewall Services:Edit
```

**Recommended Additional Permissions:**

```
Zone.Zone Settings:Read
Zone.Zone:Read
Account.Account Rulesets:Edit (for account-level rules)
```

### Environment Variables

```bash
# Required
CLOUDFLARE_API_TOKEN="your_api_token_here"
CLOUDFLARE_ZONE_ID="your_zone_id_here"

# Optional (for account-level operations)
CLOUDFLARE_ACCOUNT_ID="your_account_id_here"
```

### Finding Your Zone ID

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select your domain
3. Scroll down on Overview page
4. Copy Zone ID from the right sidebar

Or via API:

```bash
curl -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer YOUR_API_TOKEN"
```

---

## Rate Limits

### API Rate Limits

**Cloudflare API Rate Limits:**

- **1,200 requests per 5 minutes** per API token
- Rate limit headers in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

**Error Response (429 Too Many Requests):**

```json
{
  "success": false,
  "errors": [
    {
      "code": 10000,
      "message": "Rate limit exceeded"
    }
  ]
}
```

### Best Practices

1. **Implement exponential backoff** for retries
2. **Monitor rate limit headers** in responses
3. **Batch operations** when possible
4. **Cache ruleset data** locally to reduce API calls
5. **Use webhook/polling** for change detection (if available)

### Implementation Strategy for Doorman

```typescript
// Pseudo-code for rate limit handling
class CloudflareClient {
  private async makeRequest(url: string, options: RequestInit) {
    const response = await fetch(url, options)

    // Check rate limit headers
    const remaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')
    const reset = parseInt(response.headers.get('X-RateLimit-Reset') || '0')

    if (response.status === 429) {
      const waitTime = reset * 1000 - Date.now()
      await this.delay(waitTime)
      return this.makeRequest(url, options) // Retry
    }

    // Warn if approaching limit
    if (remaining < 100) {
      logger.warn(`Approaching rate limit: ${remaining} requests remaining`)
    }

    return response
  }
}
```

---

## Comparison: Cloudflare vs Vercel

### Architecture Differences

| Aspect                | Vercel Firewall         | Cloudflare WAF                                |
| --------------------- | ----------------------- | --------------------------------------------- |
| **Rule Format**       | Structured JSON objects | String expressions (wirefilter)               |
| **Config Structure**  | Single config version   | Rulesets with versions                        |
| **Rule Organization** | Flat list + IP list     | Rulesets → Rules hierarchy                    |
| **Phases**            | Single firewall phase   | Multiple phases (custom, managed, rate limit) |
| **Versioning**        | Config-level versions   | Ruleset-level versions                        |
| **IP Blocking**       | Separate IP list        | Custom rules with IP expressions              |

### Feature Mapping

#### Condition Types

| Vercel Type   | Cloudflare Field              | Translation                      |
| ------------- | ----------------------------- | -------------------------------- |
| `host`        | `http.host`                   | Direct mapping                   |
| `path`        | `http.request.uri.path`       | Direct mapping                   |
| `method`      | `http.request.method`         | Direct mapping                   |
| `header`      | `http.request.headers["key"]` | Requires key transformation      |
| `query`       | `http.request.uri.query`      | String matching                  |
| `cookie`      | `http.cookie`                 | Direct mapping                   |
| `ip_address`  | `ip.src`                      | Direct mapping                   |
| `region`      | `ip.geoip.country`            | Mapping needed                   |
| `user_agent`  | `http.user_agent`             | Direct mapping                   |
| `geo_country` | `ip.geoip.country`            | Direct mapping                   |
| `environment` | N/A                           | Not applicable (Vercel-specific) |

#### Operators

| Vercel Operator | Cloudflare Equivalent   | Notes                   |
| --------------- | ----------------------- | ----------------------- |
| `eq`            | `eq`                    | Equals                  |
| `pre`           | `starts_with()`         | Prefix/starts with      |
| `suf`           | `ends_with()`           | Suffix/ends with        |
| `inc`           | `in {}`                 | Is any of (list)        |
| `sub`           | `contains()`            | Contains substring      |
| `re`            | `matches`               | Regex (Enterprise only) |
| `ex`            | Check for existence     | Custom logic            |
| `nex`           | Check for non-existence | Custom logic            |
| `neg`           | `not (...)`             | Negation wrapper        |

#### Actions

| Vercel Action | Cloudflare Action   | Notes                   |
| ------------- | ------------------- | ----------------------- |
| `log`         | `log`               | Direct mapping          |
| `deny`        | `block`             | Direct mapping          |
| `challenge`   | `managed_challenge` | Recommended mapping     |
| `bypass`      | `skip`              | Similar concept         |
| `rate_limit`  | Rate limit rules    | Separate ruleset/config |
| `redirect`    | `redirect`          | Direct mapping          |

### Translation Challenges

#### 1. Nested Condition Groups

**Vercel:** Supports nested AND/OR groups

```json
{
  "conditionGroup": [
    {
      "conditions": [
        { "type": "path", "op": "eq", "value": "/api" },
        { "type": "method", "op": "eq", "value": "POST" }
      ]
    },
    {
      "conditions": [{ "type": "ip_address", "op": "eq", "value": "1.2.3.4" }]
    }
  ]
}
```

**Cloudflare:** Requires expression string

```
(http.request.uri.path eq "/api" and http.request.method eq "POST") or (ip.src eq 1.2.3.4)
```

**Translation Logic:**

- Each condition group = OR relationship
- Conditions within group = AND relationship
- Build expression string with proper parentheses

#### 2. Header/Cookie Key-Value Matching

**Vercel:** Structured format

```json
{
  "type": "header",
  "key": "X-Custom-Header",
  "op": "eq",
  "value": "secret"
}
```

**Cloudflare:** Expression with array syntax

```
http.request.headers["x-custom-header"][0] eq "secret"
```

#### 3. Rate Limiting

**Vercel:** Inline rate limit action

```json
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

**Cloudflare:** Separate rate limit rule with characteristics

```json
{
  "action": "block",
  "ratelimit": {
    "characteristics": ["ip.src"],
    "period": 60,
    "requests_per_period": 100,
    "mitigation_timeout": 600
  }
}
```

#### 4. IP Blocking Lists

**Vercel:** Separate IP array

```json
{
  "ips": [
    {
      "ip": "192.168.1.1",
      "hostname": "bad-actor",
      "action": "deny"
    }
  ]
}
```

**Cloudflare:** Custom rule with IP expression

```json
{
  "action": "block",
  "expression": "ip.src in {192.168.1.1}",
  "description": "Block bad-actor (192.168.1.1)"
}
```

---

## Resources

### Official Documentation

- [Cloudflare WAF Overview](https://developers.cloudflare.com/waf/)
- [Ruleset Engine](https://developers.cloudflare.com/ruleset-engine/)
- [Custom Rules](https://developers.cloudflare.com/waf/custom-rules/)
- [API Reference - Rulesets](https://developers.cloudflare.com/api/operations/listZoneRulesets)
- [API Reference - WAF Rules (Deprecated)](https://developers.cloudflare.com/api/operations/waf-rules-list-waf-rules)
- [Ruleset JSON Structure](https://developers.cloudflare.com/ruleset-engine/rulesets-api/json-object/)
- [Rules Language (Wirefilter)](https://developers.cloudflare.com/ruleset-engine/rules-language/)

### API Endpoints Quick Reference

```
# Rulesets
GET    /zones/{zone_id}/rulesets
GET    /zones/{zone_id}/rulesets/{ruleset_id}
POST   /zones/{zone_id}/rulesets
PUT    /zones/{zone_id}/rulesets/{ruleset_id}
DELETE /zones/{zone_id}/rulesets/{ruleset_id}

# Rules
POST   /zones/{zone_id}/rulesets/{ruleset_id}/rules
PATCH  /zones/{zone_id}/rulesets/{ruleset_id}/rules/{rule_id}
DELETE /zones/{zone_id}/rulesets/{ruleset_id}/rules/{rule_id}
```

### Community Resources

- [Cloudflare Community](https://community.cloudflare.com/)
- [Cloudflare Workers Examples](https://developers.cloudflare.com/workers/examples/)
- [Cloudflare API Client Libraries](https://developers.cloudflare.com/fundamentals/api/libraries/)

### Tools

- [Cloudflare API Token Generator](https://dash.cloudflare.com/profile/api-tokens)
- [Cloudflare Dashboard](https://dash.cloudflare.com/)
- [API Documentation Interactive Explorer](https://developers.cloudflare.com/api/)

---

## Notes for Implementation

### Critical Considerations

1. **Expression Parser:** Need robust parser for wirefilter syntax
2. **Backward Compatibility:** Maintain Vercel support while adding Cloudflare
3. **Rate Limit Handling:** Implement proper retry/backoff logic
4. **Versioning:** Track ruleset versions for rollback capability
5. **Testing:** Mock API responses for unit tests
6. **Error Handling:** Comprehensive error messages for API failures
7. **Validation:** Pre-validate expressions before API submission

### Recommended Libraries

- **No external parser needed** - Build custom expression generator
- **Zod** - Already in use for schema validation
- **Existing HTTP client** - Use native `fetch` (already in use)

### Performance Optimization

- Cache ruleset data locally
- Batch operations when possible
- Minimize API calls during sync
- Use conditional requests (ETags) if available
- Implement request queuing for rate limit compliance

---

**Document Version:** 1.0
**Last Updated:** 2025-01-15
**Author:** Vercel Doorman Development Team
