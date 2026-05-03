# Vercel Doorman Command Comparison

## 🔍 **`status` vs `list` - Key Differences**

### **`list` Command**

```bash
vercel-doorman list [configVersion]
```

**Purpose**: Display current firewall rules from Vercel

- **Source**: Always fetches from Vercel API (remote only)
- **Shows**: Actual deployed rules and their configurations
- **Output**: Table or JSON format of current rules
- **Use Case**: "What firewall rules are currently active on Vercel?"
- **When to use**:
  - Check what's currently deployed
  - Audit existing rules
  - Export current configuration
  - View specific version of rules

**Example Output**:

```
Found 3 custom rules and 2 IP blocking rules
Version: 5 • Last Updated: Dec 4, 2024 at 2:30 PM

Custom Rules:
┌─────────────────────┬────────────┬────────┬─────────────┐
│ Name                │ Action     │ Active │ Description │
├─────────────────────┼────────────┼────────┼─────────────┤
│ Block Bad Bots      │ deny       │ ✅     │ Block bots  │
│ Rate Limit API      │ rate_limit │ ✅     │ Limit API   │
└─────────────────────┴────────────┴────────┴─────────────┘
```

### **`status` Command**

```bash
vercel-doorman status
```

**Purpose**: Show sync status between local config and remote Vercel

- **Source**: Compares local config file with remote state
- **Shows**: Differences, version mismatches, health score
- **Output**: Sync status summary with change indicators
- **Use Case**: "Are my local changes in sync with Vercel?"
- **When to use**:
  - Before running sync
  - Check if local changes need deployment
  - Verify sync completed successfully
  - Monitor configuration health

**Example Output**:

```
📊 Sync Status Summary

Local Version: 4
Remote Version: 5
Version Status: Out of sync

Custom Rules:
  + 1 to add
  ~ 0 to update
  - 0 to delete

⚠️ Changes detected. Run `sync` to apply changes.

🏥 Configuration Health Score: 85/100
✅ Good configuration with minor recommendations
```

## 📋 **Complete Command Reference**

### **Setup & Initialization**

| Command | Purpose                            | When to Use                       |
| ------- | ---------------------------------- | --------------------------------- |
| `setup` | Show setup guide and helpful links | First time setup, troubleshooting |
| `init`  | Create new configuration file      | Starting new project              |

### **Information & Status**

| Command  | Purpose                     | Source         | Output         |
| -------- | --------------------------- | -------------- | -------------- |
| `list`   | Show current deployed rules | Remote only    | Rule details   |
| `status` | Show sync status & health   | Local + Remote | Sync summary   |
| `diff`   | Show detailed differences   | Local + Remote | Change details |

### **Configuration Management**

| Command    | Purpose                       | Direction      | Safety                   |
| ---------- | ----------------------------- | -------------- | ------------------------ |
| `sync`     | Apply local changes to remote | Local → Remote | Prompts for confirmation |
| `download` | Get remote config to local    | Remote → Local | Overwrites local         |
| `validate` | Check config syntax           | Local only     | Read-only                |

### **Advanced Features**

| Command    | Purpose                   | Use Case                 |
| ---------- | ------------------------- | ------------------------ |
| `watch`    | Auto-sync on file changes | Development workflow     |
| `backup`   | Backup/restore configs    | Safety & rollback        |
| `export`   | Export in various formats | Documentation, Terraform |
| `template` | Add predefined rules      | Quick rule setup         |

## 🔄 **Recommended Workflows**

### **Development Workflow**

```bash
# 1. Setup (first time only)
vercel-doorman setup              # Read setup guide
vercel-doorman init --interactive # Create config

# 2. Development cycle
vercel-doorman watch             # Auto-sync during development
# OR manual cycle:
vercel-doorman status            # Check what needs sync
vercel-doorman diff              # See detailed changes
vercel-doorman sync              # Apply changes
```

### **Production Workflow**

```bash
# 1. Safety first
vercel-doorman backup            # Create backup

# 2. Review changes
vercel-doorman status            # Quick overview
vercel-doorman diff              # Detailed review
vercel-doorman validate          # Check syntax

# 3. Deploy
vercel-doorman sync              # Apply changes

# 4. Verify
vercel-doorman status            # Confirm sync
vercel-doorman list              # See deployed rules
```

### **Audit & Maintenance**

```bash
# Check current state
vercel-doorman list              # What's deployed
vercel-doorman status            # Health & sync status

# Export for documentation
vercel-doorman export --format markdown

# Backup management
vercel-doorman backup --list     # See available backups
vercel-doorman backup            # Create new backup
```

## 🎯 **Quick Decision Guide**

**Want to see what's currently deployed?** → `list`

**Want to check if you need to sync?** → `status`

**Want to see exactly what will change?** → `diff`

**Want to apply your local changes?** → `sync`

**Want to get the latest from Vercel?** → `download`

**Want to auto-sync during development?** → `watch`

**Want to be safe before big changes?** → `backup`

**Need help getting started?** → `setup` then `init`

## 💡 **Pro Tips**

1. **Always check `status` before `sync`** - Know what you're changing
2. **Use `backup` before major changes** - Safety first
3. **Use `watch` during development** - Faster iteration
4. **Use `diff --format json` in CI/CD** - Programmatic access
5. **Check `list` after `sync`** - Verify deployment
6. **Use `export --format markdown`** - Generate documentation
7. **Run `setup` when onboarding team members** - Consistent setup

The enhanced command set provides a complete toolkit for managing Vercel firewall configurations with confidence and efficiency!
