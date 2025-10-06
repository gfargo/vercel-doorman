import chalk from 'chalk'
import { Stats, watchFile, unwatchFile } from 'fs'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallService } from '../lib/services/FirewallService'
import { VercelClient } from '../lib/services/VercelClient'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { getConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

interface WatchOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  interval?: number
  debug?: boolean
}

export const command = 'watch'
export const desc = 'Watch config file for changes and auto-sync'

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
}

export const handler = async (argv: Arguments<WatchOptions>) => {
  let isProcessing = false
  let client: VercelClient
  let service: FirewallService
  let lastModified = 0

  const configPath = argv.config || 'vercel-firewall.config.json'

  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    // Initial setup
    logger.start('Setting up watch mode...')

    const config = await getConfig(configPath)
    const { token, projectId, teamId } = await promptForCredentials({
      token: argv.token,
      projectId: argv.projectId || config.projectId,
      teamId: argv.teamId || config.teamId,
    })

    client = new VercelClient(projectId, teamId, token)
    service = new FirewallService(client)

    logger.success(chalk.green(`👀 Watching ${configPath} for changes...`))
    logger.log(chalk.dim('Press Ctrl+C to stop watching'))
    logger.log('')

    const handleFileChange = async (curr: Stats, prev: Stats) => {
      // Avoid processing if already processing or file hasn't actually changed
      if (isProcessing || curr.mtime.getTime() === lastModified) {
        return
      }

      isProcessing = true
      lastModified = curr.mtime.getTime()

      try {
        logger.log(chalk.yellow(`📝 Config file changed at ${new Date().toLocaleTimeString()}`))
        logger.start('Validating and syncing changes...')

        // Reload config
        const updatedConfig = await getConfig(configPath)

        // Check for changes
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

        // Show what will be synced
        const totalChanges =
          toAdd.length + toUpdate.length + toDelete.length + ipsToAdd.length + ipsToUpdate.length + ipsToDelete.length
        logger.log(chalk.cyan(`Syncing ${totalChanges} changes...`))

        // Perform sync
        await service.syncRules(updatedConfig, { debug: argv.debug })

        logger.success(chalk.green(`✅ Sync completed at ${new Date().toLocaleTimeString()}`))
        logger.log(chalk.dim('Watching for more changes...'))
      } catch (error) {
        logger.error(chalk.red(`❌ Sync failed: ${error instanceof Error ? error.message : String(error)}`))
        logger.log(chalk.dim('Continuing to watch for changes...'))
      } finally {
        isProcessing = false
      }
    }

    // Start watching
    watchFile(configPath, { interval: argv.interval }, handleFileChange)

    // Handle graceful shutdown
    const cleanup = () => {
      logger.log('\n')
      logger.info(chalk.yellow('Stopping watch mode...'))
      unwatchFile(configPath)
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)

    // Keep the process alive
    const keepAlive = () => {
      setTimeout(keepAlive, 1000)
    }
    keepAlive()
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error setting up watch mode:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
