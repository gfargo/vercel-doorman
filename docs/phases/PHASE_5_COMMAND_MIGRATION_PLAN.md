# Command Migration Plan

**Project:** Vercel Doorman v2.0 - Command Layer Updates
**Status:** Phase 5 - Planning
**Prerequisites:** Phases 1-4 Complete ✅

---

## Overview

This document outlines the plan for migrating all 12 CLI commands to use the multi-provider infrastructure established in Phases 1-4.

---

## Migration Strategy

### Approach

**Incremental Migration:** Update commands one at a time, testing thoroughly between each update.

**Backward Compatibility:** Ensure existing usage patterns continue to work.

**Provider Detection:** Use automatic provider detection with manual override.

### Common Pattern

All commands will follow this pattern:

```typescript
export const handler = async (argv: Arguments<Options>) => {
  // 1. Get configuration
  const config = await getConfig(argv.config)

  // 2. Get provider instance (auto-detect or explicit)
  const provider = await getProviderInstance({
    provider: argv.provider,
    config,
    interactive: !argv.ci,
    // Pass through credentials
    token: argv.token,
    projectId: argv.projectId,
    teamId: argv.teamId,
    apiToken: argv.apiToken,
    zoneId: argv.zoneId,
    accountId: argv.accountId,
  })

  // 3. Verify credentials
  if (!(await verifyProviderCredentials(provider))) {
    throw new Error(`Invalid ${provider.name} credentials`)
  }

  // 4. Use provider interface
  // ... command-specific logic
}
```

---

## Command Priority

### Tier 1: Core Commands (High Priority)

**1. sync** - Most frequently used
**2. download** - Common operation
**3. status** - Information display
**4. list** - View rules

### Tier 2: Important Commands (Medium Priority)

**5. diff** - Compare changes
**6. validate** - Configuration validation
**7. export** - Export functionality
**8. template** - Template management

### Tier 3: Utility Commands (Lower Priority)

**9. backup** - Backup/restore
**10. watch** - File watching
**11. init** - Initialization
**12. setup** - Setup guide

---

## Command-Specific Plans

### 1. sync

**Current Behavior:**

- Syncs to Vercel only
- Uses VercelClient + FirewallService

**New Behavior:**

- Auto-detect provider or use `--provider` flag
- Support both Vercel and Cloudflare
- Provider-specific options

**Changes:**

```typescript
// Add to builder
provider: {
  type: 'string',
  description: 'Firewall provider (vercel or cloudflare)',
  choices: ['vercel', 'cloudflare'],
}

// Cloudflare options
apiToken: {
  type: 'string',
  description: 'Cloudflare API token',
},
zoneId: {
  type: 'string',
  description: 'Cloudflare Zone ID',
},
```

**Testing:**

- ✅ Existing Vercel usage works
- ✅ Cloudflare sync works
- ✅ Auto-detection works
- ✅ Explicit provider works

---

### 2. download

**Current Behavior:**

- Downloads from Vercel only
- Supports version parameter

**New Behavior:**

- Download from any provider
- Convert to unified format
- Provider-specific versioning

**Changes:**

- Add `--provider` flag
- Add Cloudflare credential options
- Handle provider-specific versions

**Testing:**

- ✅ Vercel download works
- ✅ Cloudflare download works
- ✅ Specific version download works

---

### 3. status

**Current Behavior:**

- Shows Vercel status only

**New Behavior:**

- Show provider name
- Provider-specific status info
- Health score from provider

**Output Example:**

```
Firewall Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Provider: Cloudflare WAF
Zone: example.com (abc123)

Configuration
  Version: N/A (Cloudflare uses timestamps)
  Rules: 45 active
  IP Rules: 12 active
  Last Updated: 2 hours ago

Health Score: 85/100 (Good)

Recommendations:
  - Add rate limiting rules
  - Review rules without descriptions
```

---

### 4. list

**Current Behavior:**

- Lists Vercel rules only

**New Behavior:**

- List rules from any provider
- Show provider name in output
- Provider-specific rule details

**Changes:**

- Add provider header
- Handle provider-specific fields
- Format provider-specific data

---

### 5. diff

**Current Behavior:**

- Diffs local vs Vercel

**New Behavior:**

- Diff local vs any provider
- Show provider in output
- Handle provider-specific differences

---

### 6. validate

**Current Behavior:**

- Validates against Vercel schema

**New Behavior:**

- Provider-aware validation
- Check provider compatibility
- Warn about unsupported features

**Output Example:**

```
Validation Results
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Provider: Cloudflare WAF

✅ Configuration is valid

Warnings:
  ⚠️  Rule "Block JA3": JA3 not supported in Cloudflare
  ⚠️  Rule "Environment Check": Environment field not available

Suggestions:
  - Use Cloudflare Bot Management for fingerprinting
  - Use custom headers for environment detection
```

---

### 7. export

**Current Behavior:**

- Exports in various formats

**New Behavior:**

- Provider-aware export
- Export in provider-specific format
- Cross-provider export

**New Options:**

```typescript
targetProvider: {
  type: 'string',
  description: 'Export for specific provider (translates rules)',
  choices: ['vercel', 'cloudflare'],
}
```

---

### 8. template

**Current Behavior:**

- Lists and applies templates

**New Behavior:**

- Filter templates by provider
- Show provider compatibility
- Translate templates on apply

**Changes:**

- Add `--provider` filter
- Show compatibility badges
- Warn about incompatible templates

---

### 9. backup

**Current Behavior:**

- Backup/restore Vercel config

**New Behavior:**

- Provider-aware backup
- Include provider metadata
- Cross-provider restore (with translation)

**Backup Format:**

```json
{
  "backup": {
    "timestamp": "2025-10-07T14:30:00Z",
    "provider": "vercel",
    "config": { ... }
  }
}
```

---

### 10. watch

**Current Behavior:**

- Watch and sync to Vercel

**New Behavior:**

- Watch and sync to detected provider
- Support multiple providers
- Provider-specific error handling

---

### 11. init

**Current Behavior:**

- Initialize Vercel config

**New Behavior:**

- Prompt for provider selection
- Create provider-specific config
- Offer multi-provider option

**Interactive Flow:**

```
? Select a provider:
  ❯ Vercel Firewall
    Cloudflare WAF
    Both (multi-provider config)

? Vercel Project ID: prj_abc123
? Vercel Team ID: team_xyz789

✅ Created firewall.config.json
```

---

### 12. setup

**Current Behavior:**

- Shows Vercel setup guide

**New Behavior:**

- Provider-specific setup guide
- Show multi-provider setup
- Provider comparison

---

## Implementation Checklist

### For Each Command

- [ ] Add `--provider` flag to builder
- [ ] Add provider-specific options to builder
- [ ] Update handler to use `getProviderInstance()`
- [ ] Update output to show provider name
- [ ] Add provider-specific error handling
- [ ] Update tests for both providers
- [ ] Update command documentation
- [ ] Verify backward compatibility

### Testing Matrix

For each command, test:

- ✅ Vercel with explicit `--provider vercel`
- ✅ Vercel with auto-detection
- ✅ Vercel with legacy credentials
- ✅ Cloudflare with explicit `--provider cloudflare`
- ✅ Cloudflare with auto-detection
- ✅ Cloudflare with credentials
- ✅ Error handling for invalid provider
- ✅ Error handling for missing credentials

---

## Migration Timeline

### Week 1: Tier 1 Commands

- Day 1-2: sync
- Day 3: download
- Day 4: status
- Day 5: list

### Week 2: Tier 2 Commands

- Day 1: diff
- Day 2: validate
- Day 3: export
- Day 4: template
- Day 5: Testing & fixes

### Week 3: Tier 3 Commands

- Day 1: backup
- Day 2: watch
- Day 3: init
- Day 4: setup
- Day 5: Final testing & documentation

---

## Success Criteria

### Functional Requirements

- ✅ All commands work with Vercel (backward compat)
- ✅ All commands work with Cloudflare
- ✅ Auto-detection works correctly
- ✅ Manual provider selection works
- ✅ Error messages are clear and helpful

### Quality Requirements

- ✅ 0 TypeScript errors
- ✅ All tests pass
- ✅ Code coverage > 80%
- ✅ Documentation updated
- ✅ Examples provided

### User Experience

- ✅ No breaking changes
- ✅ Clear provider indication in output
- ✅ Helpful error messages
- ✅ Consistent CLI patterns

---

## Risks & Mitigation

| Risk                             | Mitigation                               |
| -------------------------------- | ---------------------------------------- |
| Breaking existing workflows      | Extensive backward compatibility testing |
| Complex provider-specific logic  | Use provider interface consistently      |
| Inconsistent UX across providers | Establish UI patterns early              |
| Test complexity                  | Automated test suite for both providers  |

---

## Documentation Updates

### Files to Update

- [ ] README.md - Add multi-provider examples
- [ ] Command docs - Update each command
- [ ] Migration guide - Add command examples
- [ ] Troubleshooting - Add provider-specific issues

### New Documentation

- [ ] Provider selection guide
- [ ] Command patterns guide
- [ ] Provider-specific tips

---

## Next Steps

1. ✅ Create this plan
2. ⏳ Start with sync command (highest priority)
3. ⏳ Implement Tier 1 commands
4. ⏳ Test thoroughly
5. ⏳ Continue with Tier 2 and 3

---

_Last Updated: October 7, 2025_
_Status: Planning Complete, Ready for Implementation_
