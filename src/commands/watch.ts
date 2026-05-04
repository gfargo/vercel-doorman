import chalk from 'chalk'
import { Stats, watchFile, unwatchFile } from 'fs'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { getConfig, saveConfig } from '../lib/utils/config'
import { withCredentials } from '../lib/utils/withCredentials'

interface WatchOptions {
  config?: string
  provider?: 'vercel' | 'cloudflare'
  projectId?: string
  teamId?: string
  token?: string
  apiToken?: string
  zoneId?: string
  accountId?: string
  interval?: number
  debug?: boolean
  ci?: boolean
}

export const command = 'watch'
export const desc = 'Watch config file for changes and auto-sync'

export const builder = {
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path to firewall config file (defaults to .doorman.json)',
  },
  provider: { type: 'string', choices: ['vercel', 'cloudflare'], description: 'Firewall provider (auto-detected)' },
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
  apiToken: { type: 'string', description: 'Cloudflare API token (defaults to CLOUDFLARE_API_TOKEN env var)' },
  zoneId: { type: 'string', description: 'Cloudflare Zone ID (defaults to CLOUDFLARE_ZONE_ID env var)' },
  accountId: { type: 'string', description: 'Cloudflare Account ID (optional)' },
  interval: {
    alias: 'i',
    type: 'number',
    description: 'Watch interval in milliseconds',
    default: 1000,
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
  ci: { type: 'boolean', description: 'Run in CI mode (non-interactive)', default: false },
}

export const handler = async (argv: Arguments<WatchOptions>) => {
  const configPath = argv.config || '.doorman.json'

  await withCredentials(
    {
      config: configPath,
      provider: argv.provider,
      projectId: argv.projectId,
      teamId: argv.teamId,
      token: argv.token,
      apiToken: argv.apiToken,
      zoneId: argv.zoneId,
      accountId: argv.accountId,
      debug: argv.debug,
      ci: argv.ci,
      errorContext: 'setting up watch mode',
    },
    async ({ service }) => {
      let isProcessing = false
      let lastModified = 0

      logger.success(chalk.green(`👀 Watching ${configPath} for changes...`))
      logger.log(chalk.dim('Press Ctrl+C to stop watching'))
      logger.log('')

      const handleFileChange = async (curr: Stats, _prev: Stats) => {
        if (isProcessing || curr.mtime.getTime() === lastModified) {
          return
        }

        isProcessing = true
        lastModified = curr.mtime.getTime()

        try {
          logger.log(chalk.yellow(`📝 Config file changed at ${new Date().toLocaleTimeString()}`))
          logger.start('Validating and syncing changes...')

          const updatedConfig = await getConfig(configPath)

          const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } =
            await service.getChanges(updatedConfig)

          const hasChanges =
            toAdd.length > 0 ||
            toUpdate.length > 0 ||
            toDelete.length > 0 ||
            ipsToAdd.length > 0 ||
            ipsToUpdate.length > 0 ||
            ipsToDelete.length > 0 ||
            updatedConfig.version !== version

          if (!hasChanges) {
            logger.info(chalk.blue('No changes detected, skipping sync'))
            return
          }

          const totalChanges =
            toAdd.length + toUpdate.length + toDelete.length + ipsToAdd.length + ipsToUpdate.length + ipsToDelete.length
          logger.log(chalk.cyan(`Syncing ${totalChanges} changes...`))

          const syncResult = await service.syncRules(updatedConfig, { debug: argv.debug })

          try {
            const validatedConfig = await service.validateAndUpdateConfig(updatedConfig, syncResult, { dryRun: false })
            await saveConfig(validatedConfig, configPath)
            logger.success(chalk.green(`✅ Sync completed at ${new Date().toLocaleTimeString()}`))
          } catch (validationError) {
            logger.warn(
              chalk.yellow(
                `⚠️ Sync applied but validation failed: ${validationError instanceof Error ? validationError.message : String(validationError)}`,
              ),
            )
            logger.info(chalk.dim('Run `download` to reconcile local config with remote state'))
          }

          logger.log(chalk.dim('Watching for more changes...'))
        } catch (error) {
          logger.error(chalk.red(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`))
          logger.log(chalk.dim('Continuing to watch for changes...'))
        } finally {
          isProcessing = false
        }
      }

      watchFile(configPath, { interval: argv.interval }, handleFileChange)

      const cleanup = () => {
        logger.log('\n')
        logger.info(chalk.yellow('Stopping watch mode...'))
        unwatchFile(configPath)
        process.exit(0)
      }

      process.on('SIGINT', cleanup)
      process.on('SIGTERM', cleanup)

      const keepAlive = () => {
        setTimeout(keepAlive, 1000)
      }
      keepAlive()
    },
  )
}
