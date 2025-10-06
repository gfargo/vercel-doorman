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

interface ExportOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  format?: 'json' | 'yaml' | 'terraform' | 'markdown'
  output?: string
  source?: 'local' | 'remote'
  debug?: boolean
}

export const command = 'export'
export const desc = 'Export firewall configuration in various formats'

export const builder = {
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path to firewall config file (defaults to vercel-firewall.config.json)',
  },
  projectId: {
    alias: 'p',
    type: 'string',
    description: 'Vercel Project ID (can be set in config file)',
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID (can be set in config file)',
  },
  token: {
    type: 'string',
    description: 'Vercel API token (defaults to VERCEL_TOKEN env var)',
  },
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
    description: 'Export from local config or remote Vercel',
    default: 'local',
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
}

const generateMarkdownReport = (config: FirewallConfig): string => {
  const { rules, ips, version, updatedAt } = config

  let markdown = `# Vercel Firewall Configuration Report\n\n`
  markdown += `**Version:** ${version}\n`
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

    if (argv.source === 'remote') {
      // Export from remote Vercel
      const localConfig = await getConfig(argv.config)
      const { token, projectId, teamId } = await promptForCredentials({
        token: argv.token,
        projectId: argv.projectId || localConfig.projectId,
        teamId: argv.teamId || localConfig.teamId,
      })

      const client = new VercelClient(projectId, teamId, token)
      logger.start('Fetching remote configuration...')
      config = await client.fetchFirewallConfig()
    } else {
      // Export from local config
      config = await getConfig(argv.config)
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
        output = `# Vercel Firewall Configuration\n`
        output += `version: ${config.version}\n`
        output += `updatedAt: "${config.updatedAt}"\n`
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
        output = generateMarkdownReport(config)
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
