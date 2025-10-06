import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { displayIPBlockingTable, displayRulesTable, RULE_STATUS_MAP } from '../lib/ui/table'
import { getConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

interface DiffOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  debug?: boolean
  format?: 'table' | 'json'
}

export const command = 'diff'
export const desc = 'Show detailed differences between local and remote firewall configuration'

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
    choices: ['table', 'json'],
    description: 'Output format',
    default: 'table',
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
}

export const handler = async (argv: Arguments<DiffOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    // Load and validate config
    const config = await getConfig(argv.config)

    const { token, projectId, teamId } = await promptForCredentials({
      token: argv.token,
      projectId: argv.projectId || config.projectId,
      teamId: argv.teamId || config.teamId,
    })

    const client = new VercelClient(projectId, teamId, token)
    const service = new FirewallService(client)

    logger.start('Calculating differences...')

    const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } = await service.getChanges(config)

    const hasCustomRuleChanges = toAdd.length > 0 || toUpdate.length > 0 || toDelete.length > 0
    const hasIPRuleChanges = ipsToAdd.length > 0 || ipsToUpdate.length > 0 || ipsToDelete.length > 0
    const hasVersionChange = config.version !== version

    if (!hasCustomRuleChanges && !hasIPRuleChanges && !hasVersionChange) {
      logger.success(chalk.green('No differences found. Local and remote configurations are in sync.'))
      return
    }

    if (argv.format === 'json') {
      // JSON output for programmatic use
      const diff = {
        version: {
          local: config.version,
          remote: version,
          changed: hasVersionChange,
        },
        customRules: {
          toAdd: toAdd.map((rule) => ({ ...rule, status: 'add' })),
          toUpdate: toUpdate.map((rule) => ({ ...rule, status: 'update' })),
          toDelete: toDelete.map((rule) => ({ ...rule, status: 'delete' })),
        },
        ipRules: {
          toAdd: ipsToAdd.map((rule) => ({ ...rule, status: 'add' })),
          toUpdate: ipsToUpdate.map((rule) => ({ ...rule, status: 'update' })),
          toDelete: ipsToDelete.map((rule) => ({ ...rule, status: 'delete' })),
        },
        summary: {
          hasChanges: hasCustomRuleChanges || hasIPRuleChanges || hasVersionChange,
          customRuleChanges: toAdd.length + toUpdate.length + toDelete.length,
          ipRuleChanges: ipsToAdd.length + ipsToUpdate.length + ipsToDelete.length,
        },
      }

      logger.log(JSON.stringify(diff, null, 2))
      return
    }

    // Table format (default)
    logger.log(chalk.bold('\n🔍 Configuration Differences\n'))

    if (hasVersionChange) {
      logger.log(chalk.bold('Version Changes:'))
      logger.log(`  Local:  ${chalk.red(config.version || 'unknown')}`)
      logger.log(`  Remote: ${chalk.green(version)}`)
      logger.log('')
    }

    if (hasCustomRuleChanges) {
      logger.log(chalk.bold('Custom Rule Changes:\n'))
      displayRulesTable(
        [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...toAdd.map((rule: any) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id as string })),
          ...toUpdate.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.modified, id: rule.id as string })),
          ...toDelete.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.deleted, id: rule.id as string })),
        ],
        { showStatus: true },
      )
      logger.log('')
    }

    if (hasIPRuleChanges) {
      logger.log(chalk.bold('IP Blocking Rule Changes:\n'))
      displayIPBlockingTable(
        [
          ...ipsToAdd.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id || undefined })),
          ...ipsToUpdate.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.modified, id: rule.id || undefined })),
          ...ipsToDelete.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.deleted, id: rule.id || undefined })),
        ],
        { showStatus: true },
      )
      logger.log('')
    }

    // Summary
    const totalChanges =
      toAdd.length + toUpdate.length + toDelete.length + ipsToAdd.length + ipsToUpdate.length + ipsToDelete.length
    logger.log(chalk.bold(`Summary: ${totalChanges} total changes detected`))
    logger.log(chalk.dim('Run `sync` to apply these changes to the remote configuration.'))
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error calculating diff:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
