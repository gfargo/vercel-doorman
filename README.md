# 🚪 Vercel Doorman

[![NPM Version](https://img.shields.io/npm/v/vercel-doorman.svg)](https://www.npmjs.com/package/vercel-doorman)
[![Typescript Support](https://img.shields.io/npm/types/vercel-doorman.svg)](https://www.npmjs.com/package/vercel-doorman)
[![NPM Downloads](https://img.shields.io/npm/dt/vercel-doorman.svg)](https://www.npmjs.com/package/vercel-doorman)
[![GitHub issues](https://img.shields.io/github/issues/gfargo/vercel-doorman)](https://github.com/gfargo/vercel-doorman/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/gfargo/vercel-doorman)](https://github.com/gfargo/vercel-doorman/pulls)
[![Last Commit](https://img.shields.io/github/last-commit/gfargo/vercel-doorman)](https://github.com/gfargo/vercel-doorman/tree/main)

**The complete toolkit for managing [Vercel Firewall](https://vercel.com/docs/security/vercel-firewall) rules as code.**

Doorman enables Infrastructure as Code (IaC) for Vercel's security layer, bringing version control, automated deployment, and team collaboration to your firewall configuration.

## ✨ Features

### Core Functionality

- � **SComplete Rule Management** - Create, update, delete custom rules and IP blocking
- 🔄 **Bidirectional Sync** - Keep local configs and Vercel in perfect sync
- 📊 **Smart Status Checking** - Know exactly what needs syncing before you deploy
- � **Destailed Diff Analysis** - See exactly what will change with color-coded output
- ✅ **Advanced Validation** - Syntax checking plus configuration health scoring

### Developer Experience

- 🚀 **Interactive Setup** - Guided initialization with helpful links and validation
- 👀 **Watch Mode** - Auto-sync during development for faster iteration
- 📋 **Multiple Output Formats** - Table, JSON, YAML, Markdown, and Terraform export
- 🛡️ **Safety First** - Backup/restore functionality and confirmation prompts
- 📚 **Rich Templates** - Pre-built security rules from Vercel's template library

### Enterprise Ready

- 🔄 **CI/CD Integration** - JSON outputs and validation perfect for automation
- 📈 **Health Monitoring** - Configuration scoring and best practice recommendations
- 🏥 **Comprehensive Testing** - 50+ test scenarios covering edge cases and failures
- 📖 **Documentation Export** - Generate team documentation in multiple formats

## 🚀 Quick Start

### Installation

```bash
npm install -g vercel-doorman
# or
yarn global add vercel-doorman
# or
pnpm add -g vercel-doorman
```

### Get Started in 30 Seconds

```bash
# 1. See the setup guide
vercel-doorman setup

# 2. Initialize your project (interactive)
vercel-doorman init --interactive

# 3. Check your configuration health
vercel-doorman status

# 4. Deploy your rules
vercel-doorman sync
```

## 📋 Configuration

Doorman uses a simple JSON configuration file with full TypeScript support and JSON Schema validation:

```json
{
  "$schema": "https://doorman.griffen.codes/schema.json",
  "projectId": "prj_abc123",
  "teamId": "team_xyz789",
  "rules": [
    {
      "id": "rule_block_bots",
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
  ],
  "ips": [
    {
      "ip": "192.168.1.100",
      "hostname": "suspicious-host",
      "action": "deny"
    }
  ]
}
```

### 🎨 Getting Started with Rules

**Option 1: Use Templates** (Recommended)

```bash
vercel-doorman template          # Browse available templates
vercel-doorman template ai-bots  # Add AI bot protection
```

**Option 2: Interactive Setup**

```bash
vercel-doorman init security-focused  # Start with security templates
```

**Option 3: Import Existing**

```bash
vercel-doorman download  # Import your current Vercel rules
```

### 📚 Examples & Templates

- **[Template Library](https://vercel.com/templates/vercel-firewall)** - Official Vercel templates
- **[Example Configurations](/examples)** - Real-world configuration examples
- **[Rule Builder Guide](https://vercel.com/docs/security/vercel-firewall)** - Vercel's official documentation

## 🛠️ Commands

### Setup & Initialization

| Command | Description                                       | Example                             |
| ------- | ------------------------------------------------- | ----------------------------------- |
| `setup` | Show comprehensive setup guide with links         | `vercel-doorman setup`              |
| `init`  | Create new configuration with interactive prompts | `vercel-doorman init --interactive` |

### Status & Information

| Command  | Description                                        | Use Case                 |
| -------- | -------------------------------------------------- | ------------------------ |
| `status` | Show sync status and configuration health          | Before syncing changes   |
| `list`   | Display current deployed rules                     | Audit what's live        |
| `diff`   | Show detailed differences between local and remote | Review before deployment |

### Configuration Management

| Command    | Description                           | Direction        |
| ---------- | ------------------------------------- | ---------------- |
| `sync`     | Apply local changes to Vercel         | Local → Remote   |
| `download` | Import Vercel rules to local config   | Remote → Local   |
| `validate` | Check configuration syntax and health | Local validation |

### Advanced Features

| Command    | Description                                                  | Use Case             |
| ---------- | ------------------------------------------------------------ | -------------------- |
| `watch`    | Auto-sync on file changes                                    | Development workflow |
| `backup`   | Create/restore configuration backups                         | Safety & rollback    |
| `export`   | Export in multiple formats (JSON, YAML, Markdown, Terraform) | Documentation & IaC  |
| `template` | Add predefined rule templates                                | Quick rule setup     |

## 🔄 Workflows

### Development Workflow

```bash
# Start watching for changes
vercel-doorman watch

# Or manual development cycle:
vercel-doorman status    # Check what needs syncing
vercel-doorman diff      # Review changes
vercel-doorman sync      # Deploy changes
```

### Production Deployment

```bash
vercel-doorman backup           # Safety first
vercel-doorman validate         # Check syntax
vercel-doorman diff             # Review changes
vercel-doorman sync             # Deploy
vercel-doorman status           # Verify deployment
```

### Team Collaboration

```bash
vercel-doorman export --format markdown  # Generate docs
vercel-doorman backup --list             # Manage backups
vercel-doorman download                  # Sync with team changes
```

## 🔧 Configuration

### Environment Variables

Set these environment variables to avoid passing credentials in commands:

```bash
export VERCEL_TOKEN="your-api-token"
export VERCEL_PROJECT_ID="prj_abc123"  # Optional
export VERCEL_TEAM_ID="team_xyz789"    # Optional if using team
```

### API Token Setup

1. Visit [Vercel Account Tokens](https://vercel.com/account/tokens)
2. Click "Create Token"
3. Name: "Doorman Firewall Management"
4. Scope: Select your project/team
5. Copy token and set as `VERCEL_TOKEN`

**Need help?** Run `vercel-doorman setup` for detailed instructions with direct links.

## 📊 Command Examples

### Basic Usage

```bash
# Quick status check
vercel-doorman status

# See what's currently deployed
vercel-doorman list

# Apply your local changes
vercel-doorman sync
```

### Advanced Usage

```bash
# Export documentation
vercel-doorman export --format markdown --output firewall-docs.md

# Backup before major changes
vercel-doorman backup

# Watch for changes during development
vercel-doorman watch

# Get detailed diff in JSON for CI/CD
vercel-doorman diff --format json
```

### CI/CD Integration

```bash
# Validate in CI pipeline
vercel-doorman validate

# Check for changes (exit code indicates changes)
vercel-doorman diff --format json > changes.json

# Deploy in production
vercel-doorman sync --config production.config.json
```

## 🏥 Configuration Health

Doorman includes a built-in health checker that scores your configuration and provides recommendations:

```bash
vercel-doorman status  # Includes health score
```

**Health Score Factors:**

- **Rule Naming** - Proper ID formats and descriptive names
- **Security Best Practices** - Rate limiting, bot protection, etc.
- **Performance Impact** - Rule complexity and regex usage
- **Maintainability** - Disabled rules, duplicates, versioning

**Score Ranges:**

- 🟢 80-100: Excellent configuration
- 🟡 60-79: Good with minor improvements needed
- 🔴 0-59: Needs attention

## 🔒 Security Best Practices

### Token Management

- Store API tokens in environment variables, never in code
- Set token expiration dates appropriately
- Use principle of least privilege for token scopes
- Regularly rotate API tokens

### Rule Management

- Test rules in staging before production
- Keep backups of working configurations
- Use descriptive names and documentation
- Start with rules disabled, enable after testing

### Team Collaboration

- Use version control for configuration files
- Document rule purposes and business logic
- Regular security audits of active rules
- Establish approval processes for rule changes

## 🚀 Advanced Features

### Watch Mode for Development

```bash
vercel-doorman watch --interval 1000
```

Automatically syncs changes when you modify your config file. Perfect for rapid development and testing.

### Backup Management

```bash
vercel-doorman backup                    # Create backup
vercel-doorman backup --list             # List backups
vercel-doorman backup --restore backup.json  # Restore backup
```

### Multi-Format Export

```bash
# Generate team documentation
vercel-doorman export --format markdown

# Export for Terraform (conceptual)
vercel-doorman export --format terraform

# CI/CD integration
vercel-doorman export --format json --source remote
```

### Configuration Health Monitoring

The health checker evaluates:

- Rule naming conventions
- Security coverage gaps
- Performance optimization opportunities
- Maintenance recommendations

## 🔧 Troubleshooting

### Common Issues

**"Project not found" error:**

- Verify your Project ID is correct
- Ensure your token has access to the project
- Check that the project has Pro plan or higher

**"Unauthorized" error:**

- Confirm `VERCEL_TOKEN` is set correctly
- Verify token hasn't expired
- Ensure token has firewall permissions

**Sync issues:**

- Run `vercel-doorman status` to see what's out of sync
- Use `vercel-doorman diff` to see detailed changes
- Check for validation errors with `vercel-doorman validate`

**Need more help?**

```bash
vercel-doorman setup  # Comprehensive setup guide
```

## 📚 Resources

- **[Setup Guide](https://github.com/gfargo/vercel-doorman#setup)** - Complete setup instructions
- **[Example Configurations](/examples)** - Real-world examples
- **[Vercel Firewall Docs](https://vercel.com/docs/security/vercel-firewall)** - Official documentation
- **[Template Library](https://vercel.com/templates/vercel-firewall)** - Pre-built rule templates
- **[API Reference](https://vercel.com/docs/rest-api/endpoints/firewall)** - Vercel Firewall API

## 🤝 Contributing

We welcome contributions! Here's how you can help:

### Development Setup

```bash
git clone https://github.com/gfargo/vercel-doorman.git
cd vercel-doorman
pnpm install
pnpm build
```

### Running Tests

```bash
pnpm test              # Run test suite
pnpm test:coverage     # Run with coverage
pnpm test:watch        # Watch mode
```

### Contributing Guidelines

- Follow existing code style and patterns
- Add tests for new features
- Update documentation for changes
- Use conventional commit messages

### Areas for Contribution

- Additional export formats
- Enhanced rule templates
- Performance optimizations
- Documentation improvements
- Bug fixes and edge cases

## 📈 Why Doorman?

### Before Doorman

- Manual firewall rule management through Vercel dashboard
- No version control for security configurations
- Difficult to sync rules across environments
- No validation or testing of rule changes
- Hard to collaborate on security policies

### After Doorman

- ✅ Infrastructure as Code for firewall rules
- ✅ Full version control and change tracking
- ✅ Automated deployment and validation
- ✅ Team collaboration with documentation
- ✅ Health monitoring and best practices
- ✅ Backup/restore and safety features

## 🎯 Use Cases

- **Startups** - Quick security setup with templates
- **Enterprise** - Automated compliance and governance
- **DevOps Teams** - CI/CD integration and IaC workflows
- **Security Teams** - Centralized policy management
- **Development Teams** - Safe iteration and testing

## 📊 Project Stats

![Alt](https://repobeats.axiom.co/api/embed/34b6b913b71bcb611b939600fc579fe8ef7b00ae.svg 'Repobeats analytics image')

## 🙏 Acknowledgments

- **Vercel Team** - For building an excellent firewall platform
- **Community Contributors** - For feedback, bug reports, and improvements
- **Security Community** - For best practices and rule templates

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

**Made with ❤️ by [Griffen Fargo](https://github.com/gfargo)**

_Securing the web, one firewall rule at a time._ 🚪🔒
