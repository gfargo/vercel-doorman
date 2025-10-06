import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { getConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

interface StatusOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  debug?: boolean
}

export const command = 'status'
export const desc = 'Show sync status between local and remote firewall configuration'

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
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
}

export const handler = async (argv: Arguments<StatusOptions>) => {
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

    logger.start('Checking sync status...')

    const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } = await service.getChanges(config)

    const hasCustomRuleChanges = toAdd.length > 0 || toUpdate.length > 0 || toDelete.length > 0
    const hasIPRuleChanges = ipsToAdd.length > 0 || ipsToUpdate.length > 0 || ipsToDelete.length > 0
    const hasVersionChange = config.version !== version

    // Display status summary
    logger.log(chalk.bold('\n📊 Sync Status Summary\n'))

    // Version info
    logger.log(`${chalk.dim('Local Version:')} ${chalk.yellow(config.version || 'unknown')}`)
    logger.log(`${chalk.dim('Remote Version:')} ${chalk.yellow(version)}`)

    if (hasVersionChange) {
      logger.log(`${chalk.dim('Version Status:')} ${chalk.red('Out of sync')}`)
    } else {
      logger.log(`${chalk.dim('Version Status:')} ${chalk.green('In sync')}`)
    }

    logger.log('')

    // Custom rules status
    logger.log(`${chalk.dim('Custom Rules:')}`)
    logger.log(`  ${chalk.green('+')} ${toAdd.length} to add`)
    logger.log(`  ${chalk.cyan('~')} ${toUpdate.length} to update`)
    logger.log(`  ${chalk.red('-')} ${toDelete.length} to delete`)

    // IP rules status
    logger.log(`${chalk.dim('IP Blocking Rules:')}`)
    logger.log(`  ${chalk.green('+')} ${ipsToAdd.length} to add`)
    logger.log(`  ${chalk.cyan('~')} ${ipsToUpdate.length} to update`)
    logger.log(`  ${chalk.red('-')} ${ipsToDelete.length} to delete`)

    logger.log('')

    // Overall status
    if (!hasCustomRuleChanges && !hasIPRuleChanges && !hasVersionChange) {
      logger.success(chalk.green('✅ Everything is in sync!'))
    } else {
      logger.warn(chalk.yellow('⚠️  Changes detected. Run `sync` to apply changes.'))

      if (hasVersionChange) {
        logger.info(chalk.dim('💡 Version mismatch detected - this will be updated during sync'))
      }
    }

    // Show last updated info if available
    if (config.updatedAt) {
      logger.log(`\n${chalk.dim('Last Updated:')} ${new Date(config.updatedAt).toLocaleString()}`)
    }

    // Add health check
    logger.log('\n' + chalk.bold('🏥 Configuration Health Check'))
    const healthResult = ConfigHealthChecker.check(config)
    const healthReport = ConfigHealthChecker.formatHealthReport(healthResult)
    logger.log(healthReport)
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error checking status:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
