import chalk from 'chalk'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { ConfigHealthChecker } from '../lib/utils/configHealth'
import { withCredentials } from '../lib/utils/withCredentials'

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
  await withCredentials(
    {
      config: argv.config,
      projectId: argv.projectId,
      teamId: argv.teamId,
      token: argv.token,
      debug: argv.debug,
      errorContext: 'checking status',
    },
    async ({ config, service }) => {
      logger.start('Checking sync status...')

      const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } =
        await service.getChanges(config)

      const hasCustomRuleChanges = toAdd.length > 0 || toUpdate.length > 0 || toDelete.length > 0
      const hasIPRuleChanges = ipsToAdd.length > 0 || ipsToUpdate.length > 0 || ipsToDelete.length > 0
      const hasVersionChange = config.version !== version

      logger.log(chalk.bold('\n📊 Sync Status Summary\n'))

      logger.log(`${chalk.dim('Local Version:')} ${chalk.yellow(config.version || 'unknown')}`)
      logger.log(`${chalk.dim('Remote Version:')} ${chalk.yellow(version)}`)

      if (hasVersionChange) {
        logger.log(`${chalk.dim('Version Status:')} ${chalk.red('Out of sync')}`)
      } else {
        logger.log(`${chalk.dim('Version Status:')} ${chalk.green('In sync')}`)
      }

      logger.log('')

      logger.log(`${chalk.dim('Custom Rules:')}`)
      logger.log(`  ${chalk.green('+')} ${toAdd.length} to add`)
      logger.log(`  ${chalk.cyan('~')} ${toUpdate.length} to update`)
      logger.log(`  ${chalk.red('-')} ${toDelete.length} to delete`)

      logger.log(`${chalk.dim('IP Blocking Rules:')}`)
      logger.log(`  ${chalk.green('+')} ${ipsToAdd.length} to add`)
      logger.log(`  ${chalk.cyan('~')} ${ipsToUpdate.length} to update`)
      logger.log(`  ${chalk.red('-')} ${ipsToDelete.length} to delete`)

      logger.log('')

      if (!hasCustomRuleChanges && !hasIPRuleChanges && !hasVersionChange) {
        logger.success(chalk.green('✅ Everything is in sync!'))
      } else {
        logger.warn(chalk.yellow('⚠️  Changes detected. Run `sync` to apply changes.'))

        if (hasVersionChange) {
          logger.info(chalk.dim('💡 Version mismatch detected - this will be updated during sync'))
        }
      }

      if (config.updatedAt) {
        logger.log(`\n${chalk.dim('Last Updated:')} ${new Date(config.updatedAt).toLocaleString()}`)
      }

      logger.log('\n' + chalk.bold('🏥 Configuration Health Check'))
      const healthResult = ConfigHealthChecker.check(config)
      const healthReport = ConfigHealthChecker.formatHealthReport(healthResult)
      logger.log(healthReport)
    },
  )
}
