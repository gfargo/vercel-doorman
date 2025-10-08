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
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface WatchOptions {
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
    description: 'Path to firewall config file (defaults to vercel-firewall.config.json)',
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
  ci: {
    type: 'boolean',
    description: 'Run in CI mode (non-interactive)',
    default: false,
  },
}

export const handler = async (argv: Arguments<WatchOptions>) => {
  let isProcessing = false
  let lastModified = 0

  const configPath = argv.config || 'vercel-firewall.config.json'

  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    // Initial setup
    logger.start('Setting up watch mode...')

    const config = await getConfig(configPath)

    // Check if this is a legacy Vercel-only usage (backward compatibility)
    const isLegacyVercelUsage =
      !argv.provider && !config.provider && (argv.projectId || argv.teamId || argv.token || config.projectId)

    if (isLegacyVercelUsage) {
      // Legacy Vercel-specific code path
      logger.debug('Using legacy Vercel code path')

      const { token, projectId, teamId } = await promptForCredentials({
        token: argv.token,
        projectId: argv.projectId || config.projectId,
        teamId: argv.teamId || config.teamId,
      })

      const client = new VercelClient(projectId, teamId, token)
      const service = new FirewallService(client)

      logger.success(chalk.green(`👀 Watching ${configPath} for changes...`))
      logger.log(chalk.dim('Press Ctrl+C to stop watching'))
      logger.log('')

      const handleFileChange = async (curr: Stats, prev: Stats) => {
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
      return
    }

    // New multi-provider code path
    logger.debug('Using multi-provider code path')

    const provider = await getProviderInstance({
      provider: argv.provider as ProviderType | undefined,
      config,
      interactive: !argv.ci,
      token: argv.token,
      projectId: argv.projectId,
      teamId: argv.teamId,
      apiToken: argv.apiToken,
      zoneId: argv.zoneId,
      accountId: argv.accountId,
    })

    const providerName = getProviderDisplayName(provider.name)
    logger.debug(`Using provider: ${providerName}`)

    logger.success(chalk.green(`👀 Watching ${configPath} for changes (${providerName})...`))
    logger.log(chalk.dim('Press Ctrl+C to stop watching'))
    logger.log('')

    const handleFileChange = async (curr: Stats, prev: Stats) => {
      if (isProcessing || curr.mtime.getTime() === lastModified) {
        return
      }

      isProcessing = true
      lastModified = curr.mtime.getTime()

      try {
        logger.log(chalk.yellow(`📝 Config file changed at ${new Date().toLocaleTimeString()}`))
        logger.start('Validating and syncing changes...')

        const updatedConfig = await getConfig(configPath)

        // Convert to unified format if needed
        const { isUnifiedConfig } = await import('../lib/types')
        const { RuleTranslator } = await import('../lib/translators/RuleTranslator')
        let unifiedConfig

        if (isUnifiedConfig(updatedConfig)) {
          unifiedConfig = updatedConfig
        } else {
          const rules = updatedConfig.rules.map((rule) => RuleTranslator.vercelToUnified(rule).result)
          const ips = (updatedConfig.ips || []).map((ip) => RuleTranslator.vercelIPToUnified(ip))

          unifiedConfig = {
            version: '2.0',
            provider: provider.name,
            rules,
            ips,
            metadata: {
              version: updatedConfig.version,
              updatedAt: updatedConfig.updatedAt,
            },
          }
        }

        const changes = await provider.getChanges(unifiedConfig)

        if (!changes.hasChanges) {
          logger.info(chalk.blue('No changes detected, skipping sync'))
          return
        }

        const totalChanges =
          changes.rulesToAdd.length +
          changes.rulesToUpdate.length +
          changes.rulesToDelete.length +
          (changes.ipsToAdd?.length || 0) +
          (changes.ipsToUpdate?.length || 0) +
          (changes.ipsToDelete?.length || 0)

        logger.log(chalk.cyan(`Syncing ${totalChanges} changes to ${providerName}...`))

        await provider.applyChanges(unifiedConfig)

        logger.success(chalk.green(`✅ Sync completed at ${new Date().toLocaleTimeString()}`))
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
