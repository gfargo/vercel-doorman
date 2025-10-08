import chalk from 'chalk'
import { writeFileSync } from 'fs'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { VercelClient } from '../lib/services/VercelClient'
import { CustomRule, FirewallConfig, IPBlockingRule } from '../lib/types'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { getConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface ExportOptions {
  config?: string
  provider?: 'vercel' | 'cloudflare'
  // Vercel options
  projectId?: string
  teamId?: string
  token?: string
  // Cloudflare options
  apiToken?: string
  zoneId?: string
  accountId?: string
  // Common options
  format?: 'json' | 'yaml' | 'terraform' | 'markdown'
  output?: string
  source?: 'local' | 'remote'
  debug?: boolean
  ci?: boolean
}

export const command = 'export'
export const desc = 'Export firewall configuration in various formats'

export const builder = {
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path to firewall config file',
  },
  provider: {
    type: 'string',
    description: 'Firewall provider (vercel or cloudflare) - auto-detected if not specified',
    choices: ['vercel', 'cloudflare'],
  },
  // Vercel options
  projectId: {
    alias: 'p',
    type: 'string',
    description: 'Vercel Project ID',
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID',
  },
  token: {
    type: 'string',
    description: 'Vercel API token (defaults to VERCEL_TOKEN env var)',
  },
  // Cloudflare options
  apiToken: {
    type: 'string',
    description: 'Cloudflare API token (defaults to CLOUDFLARE_API_TOKEN env var)',
  },
  zoneId: {
    type: 'string',
    description: 'Cloudflare Zone ID (defaults to CLOUDFLARE_ZONE_ID env var)',
  },
  accountId: {
    type: 'string',
    description: 'Cloudflare Account ID (optional, defaults to CLOUDFLARE_ACCOUNT_ID env var)',
  },
  // Common options
  format: {
    alias: 'f',
    type: 'string',
    choices: ['json', 'yaml', 'terraform', 'markdown'],
    description: 'Export format',
    default: 'json',
  },
  output: {
    alias: 'o',
    type: 'string',
    description: 'Output file path',
  },
  source: {
    alias: 's',
    type: 'string',
    choices: ['local', 'remote'],
    description: 'Export from local config or remote provider',
    default: 'local',
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
  ci: {
    type: 'boolean',
    description: 'Run in CI mode (non-interactive)',
    default: false,
  },
}

const generateMarkdownReport = (config: FirewallConfig, providerName?: string): string => {
  const { rules, ips, version, updatedAt } = config

  let markdown = `# Firewall Configuration Report\n\n`
  if (providerName) {
    markdown += `**Provider:** ${providerName}\n`
  }
  markdown += `**Version:** ${version || 'N/A'}\n`
  markdown += `**Last Updated:** ${updatedAt ? new Date(updatedAt).toLocaleString() : 'Unknown'}\n`
  markdown += `**Generated:** ${new Date().toLocaleString()}\n\n`

  // Custom Rules
  markdown += `## Custom Rules (${rules.length})\n\n`
  if (rules.length > 0) {
    rules.forEach((rule: CustomRule, index: number) => {
      markdown += `### ${index + 1}. ${rule.name}\n\n`
      markdown += `- **ID:** \`${rule.id}\`\n`
      markdown += `- **Description:** ${rule.description || 'No description'}\n`
      markdown += `- **Action:** ${rule.action.mitigate.action}\n`
      markdown += `- **Active:** ${rule.active ? '✅ Yes' : '❌ No'}\n`

      if (rule.action.mitigate.rateLimit) {
        markdown += `- **Rate Limit:** ${rule.action.mitigate.rateLimit.requests} requests per ${rule.action.mitigate.rateLimit.window}\n`
      }

      markdown += `- **Conditions:**\n`
      rule.conditionGroup.forEach((group, groupIndex) => {
        markdown += `  - Group ${groupIndex + 1}:\n`
        group.conditions.forEach((condition, condIndex) => {
          markdown += `    - ${condition.type} ${condition.op} \`${condition.value}\`\n`
        })
      })
      markdown += `\n`
    })
  } else {
    markdown += `No custom rules configured.\n\n`
  }

  // IP Blocking Rules
  markdown += `## IP Blocking Rules (${ips.length})\n\n`
  if (ips.length > 0) {
    markdown += `| IP Address | Hostname | Action |\n`
    markdown += `|------------|----------|--------|\n`
    ips.forEach((ip: IPBlockingRule) => {
      markdown += `| \`${ip.ip}\` | ${ip.hostname || 'N/A'} | ${ip.action} |\n`
    })
  } else {
    markdown += `No IP blocking rules configured.\n`
  }

  return markdown
}

const generateTerraformConfig = (config: FirewallConfig): string => {
  const { rules, ips } = config

  let terraform = `# Vercel Firewall Configuration\n`
  terraform += `# Generated on ${new Date().toISOString()}\n\n`

  // Note: This is a simplified example - actual Terraform provider would need to be implemented
  terraform += `# Note: This is a conceptual Terraform configuration\n`
  terraform += `# A Vercel Terraform provider would need to be implemented for actual use\n\n`

  rules.forEach((rule: CustomRule, index: number) => {
    terraform += `resource "vercel_firewall_rule" "rule_${index}" {\n`
    terraform += `  name        = "${rule.name}"\n`
    terraform += `  description = "${rule.description || ''}"\n`
    terraform += `  active      = ${rule.active}\n`
    terraform += `  action      = "${rule.action.mitigate.action}"\n`

    if (rule.action.mitigate.rateLimit) {
      terraform += `  rate_limit {\n`
      terraform += `    requests = ${rule.action.mitigate.rateLimit.requests}\n`
      terraform += `    window   = "${rule.action.mitigate.rateLimit.window}"\n`
      terraform += `  }\n`
    }

    terraform += `}\n\n`
  })

  ips.forEach((ip: IPBlockingRule, index: number) => {
    terraform += `resource "vercel_ip_blocking_rule" "ip_${index}" {\n`
    terraform += `  ip       = "${ip.ip}"\n`
    terraform += `  hostname = "${ip.hostname || ''}"\n`
    terraform += `  action   = "${ip.action}"\n`
    terraform += `}\n\n`
  })

  return terraform
}

export const handler = async (argv: Arguments<ExportOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    let config: FirewallConfig
    let providerName: string | undefined

    if (argv.source === 'remote') {
      // Export from remote provider
      const localConfig = await getConfig(argv.config, { validate: false, throwOnError: false })

      // Check if this is a legacy Vercel-only usage
      const isLegacyVercelUsage =
        !argv.provider &&
        !localConfig.provider &&
        (argv.projectId || argv.teamId || argv.token || localConfig.projectId)

      if (isLegacyVercelUsage) {
        // Legacy Vercel path
        logger.debug('Using legacy Vercel code path')
        const { token, projectId, teamId } = await promptForCredentials({
          token: argv.token,
          projectId: argv.projectId || localConfig.projectId,
          teamId: argv.teamId || localConfig.teamId,
        })

        const client = new VercelClient(projectId, teamId, token)
        logger.start('Fetching remote configuration from Vercel...')
        config = await client.fetchFirewallConfig()
        providerName = 'Vercel Firewall'
      } else {
        // Multi-provider path
        logger.debug('Using multi-provider code path')
        const provider = await getProviderInstance({
          provider: argv.provider as ProviderType | undefined,
          config: localConfig,
          interactive: !argv.ci,
          // Vercel credentials
          token: argv.token,
          projectId: argv.projectId,
          teamId: argv.teamId,
          // Cloudflare credentials
          apiToken: argv.apiToken,
          zoneId: argv.zoneId,
          accountId: argv.accountId,
        })

        providerName = getProviderDisplayName(provider.name)
        logger.start(`Fetching remote configuration from ${providerName}...`)

        const unifiedConfig = await provider.fetchConfig()

        // Convert unified format to Vercel format for export compatibility
        const { RuleTranslator } = await import('../lib/translators/RuleTranslator')
        const rules = unifiedConfig.rules.map((rule) => RuleTranslator.unifiedToVercel(rule).result)
        const ips = (unifiedConfig.ips || []).map((ip) => ({
          ...ip,
          hostname: ip.hostname || '',
        }))

        config = {
          projectId: localConfig.projectId || '',
          teamId: localConfig.teamId || '',
          version: unifiedConfig.metadata?.version,
          updatedAt: unifiedConfig.metadata?.updatedAt,
          rules,
          ips,
        }
      }
    } else {
      // Export from local config
      config = await getConfig(argv.config)
      providerName = config.provider ? getProviderDisplayName(config.provider as ProviderType) : undefined
    }

    logger.start(`Exporting configuration in ${argv.format} format...`)

    let output: string
    let defaultExtension: string

    switch (argv.format) {
      case 'json':
        output = JSON.stringify(config, null, 2)
        defaultExtension = 'json'
        break

      case 'yaml':
        // Simple YAML-like output (would need yaml library for proper YAML)
        output = `# Firewall Configuration\n`
        if (providerName) {
          output += `provider: "${providerName}"\n`
        }
        output += `version: ${config.version || 'N/A'}\n`
        output += `updatedAt: "${config.updatedAt || ''}"\n`
        output += `rules:\n`
        config.rules.forEach((rule: CustomRule) => {
          output += `  - name: "${rule.name}"\n`
          output += `    id: "${rule.id}"\n`
          output += `    active: ${rule.active}\n`
          output += `    action: "${rule.action.mitigate.action}"\n`
        })
        defaultExtension = 'yaml'
        break

      case 'terraform':
        output = generateTerraformConfig(config)
        defaultExtension = 'tf'
        break

      case 'markdown':
        output = generateMarkdownReport(config, providerName)
        defaultExtension = 'md'
        break

      default:
        throw new Error(`Unsupported format: ${argv.format}`)
    }

    // Determine output path
    const outputPath = argv.output || `firewall-export.${defaultExtension}`

    // Write to file or stdout
    if (argv.output === '-' || !argv.output) {
      logger.log(output)
    } else {
      writeFileSync(outputPath, output, 'utf8')
      logger.success(chalk.green(`✅ Exported to ${outputPath}`))

      // Show summary
      logger.log('')
      logger.log(chalk.bold('Export Summary:'))
      logger.log(`${chalk.dim('Format:')} ${argv.format}`)
      logger.log(`${chalk.dim('Source:')} ${argv.source}`)
      if (providerName) {
        logger.log(`${chalk.dim('Provider:')} ${providerName}`)
      }
      logger.log(`${chalk.dim('Rules:')} ${config.rules.length} custom, ${config.ips.length} IP blocking`)
      logger.log(`${chalk.dim('Size:')} ${(output.length / 1024).toFixed(1)} KB`)
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error exporting configuration:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
