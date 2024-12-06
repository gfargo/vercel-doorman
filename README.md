# Vercel Doorman

[![NPM Version](https://img.shields.io/npm/v/vercel-doorman.svg)](https://www.npmjs.com/package/vercel-doorman)
[![Typescript Support](https://img.shields.io/npm/types/vercel-doorman.svg)](https://www.npmjs.com/package/vercel-doorman)
[![NPM Downloads](https://img.shields.io/npm/dt/vercel-doorman.svg)](https://www.npmjs.com/package/vercel-doorman)
[![GitHub issues](https://img.shields.io/github/issues/gfargo/vercel-doorman)](https://github.com/gfargo/vercel-doorman/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/gfargo/vercel-doorman)](https://github.com/gfargo/vercel-doorman/pulls)
[![Last Commit](https://img.shields.io/github/last-commit/gfargo/vercel-doorman)](https://github.com/gfargo/vercel-doorman/tree/main)

A simple CLI tool for managing [Vercel Firewall](https://vercel.com/docs/security/vercel-firewall) rules as code, enabling version control and automated deployment of your project's security configuration.

## Features

- 🔒 **Manage Firewall Rules**: Create, update, and delete Vercel Firewall rules using a simple configuration file
- 🔄 **Sync Rules**: Easily sync rules between your configuration file and Vercel
- ⬇️ **Download Rules**: Import existing firewall rules from your Vercel project
- ✅ **Validation**: Built-in configuration validation to prevent errors
- 📋 **List Rules**: View current firewall rules in table or JSON format
- 🚀 **CI/CD Integration**: Automate firewall rule management in your deployment pipeline

## Installation

```bash
npm install vercel-doorman
# or
yarn add vercel-doorman
# or
pnpm add vercel-doorman
```

## Configuration

Create a `vercel-firewall.config.json` file in your project root:

```json
{
  "projectId": "your-project-id",
  "teamId": "your-team-id",
  "rules": [
    {
      "name": "block-country",
      "description": "Block traffic from specific countries",
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "geo_country",
              "op": "eq",
              "value": "CN"
            }
          ]
        },
        {
          "conditions": [
            {
              "type": "geo_country",
              "op": "eq",
              "value": "RU"
            }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "deny"
        }
      },
      "active": true
    },
    {
      "name": "rate-limit-api",
      "description": "Rate limit API endpoints",
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
          "action": "rate_limit",
          "rateLimit": {
            "requests": 100,
            "window": "60s"
          },
          "actionDuration": "1h"
        }
      },
      "active": true
    },
    {
      "name": "redirect-legacy",
      "description": "Redirect legacy paths",
      "conditionGroup": [
        {
          "conditions": [
            {
              "type": "path",
              "op": "eq",
              "value": "/old-path"
            }
          ]
        }
      ],
      "action": {
        "mitigate": {
          "action": "redirect",
          "redirect": {
            "location": "/new-path",
            "permanent": false
          }
        }
      },
      "active": true
    }
  ]
}
```

## Usage

First, [create a Vercel API Token](https://vercel.com/guides/how-do-i-use-a-vercel-api-access-token) with appropriate permissions.

### Available Commands

#### List Rules

```bash
vercel-doorman list [configVersion] --token YOUR_TOKEN
```

Lists firewall rules, either the current active configuration or a specific version.

Options:

- `configVersion`: Optional version number to fetch a specific configuration version
- `--projectId, -p`: Vercel Project ID
- `--teamId, -t`: Vercel Team ID
- `--token`: Vercel API token
- `--format, -f`: Output format (json or table, defaults to table)

Examples:

```bash
# List current active rules
vercel-doorman list

# List rules from a specific version
vercel-doorman list 1

# List specific version in JSON format
vercel-doorman list 2 --format json
```

#### Sync Rules

```bash
vercel-doorman sync --token YOUR_TOKEN
```

Options:

- `--config, -c`: Path to config file (defaults to vercel-firewall.config.json)
- `--projectId, -p`: Vercel Project ID (can be set in config file)
- `--teamId, -t`: Vercel Team ID (can be set in config file)
- `--token`: Vercel API token

#### Download Remote Rules

```bash
vercel-doorman download [configVersion] --token YOUR_TOKEN
```

Downloads firewall rules from your Vercel project and updates your local configuration file. You can download either the current active configuration or a specific version. Includes a confirmation prompt before making changes.

Options:

- `configVersion`: Optional version number to download a specific configuration version
- `--config, -c`: Path to config file (defaults to vercel-firewall.config.json)
- `--projectId, -p`: Vercel Project ID (can be set in config file)
- `--teamId, -t`: Vercel Team ID (can be set in config file)
- `--token`: Vercel API token
- `--dry-run, -d`: Preview changes without modifying the config file

Example workflows:

```bash
# Download latest configuration
# First, preview the rules
vercel-doorman download --dry-run

# Then download and update the config
vercel-doorman download

# Download specific version
# First, preview the rules from version 1
vercel-doorman download 1 --dry-run

# Then download version 1 and update the config
vercel-doorman download 1
```

#### Validate Configuration

```bash
vercel-doorman validate
```

Options:

- `--config, -c`: Path to config file (defaults to vercel-firewall.config.json)
- `--verbose, -v`: Show detailed validation results

### Environment Variables

Instead of passing command-line arguments, you can set these environment variables:

- `VERCEL_TOKEN`: Your Vercel API token
- `VERCEL_PROJECT_ID`: Your Vercel project ID
- `VERCEL_TEAM_ID`: Your Vercel team ID

## Contributing

Contributions are welcome!

## Project Stats

![Alt](https://repobeats.axiom.co/api/embed/34b6b913b71bcb611b939600fc579fe8ef7b00ae.svg 'Repobeats analytics image')

## License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.
