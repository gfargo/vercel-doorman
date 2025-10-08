import chalk from 'chalk'
import { existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { VercelClient } from '../lib/services/VercelClient'
import { FirewallConfig } from '../lib/types'
import { prompt } from '../lib/ui/prompt'
import { promptForCredentials } from '../lib/ui/promptForCredentials'
import { getConfig, saveConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface BackupOptions {
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
  output?: string
  restore?: string
  list?: boolean
  debug?: boolean
  ci?: boolean
}

export const command = 'backup'
export const desc = 'Backup or restore firewall configurations'

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
  output: {
    alias: 'o',
    type: 'string',
    description: 'Output directory for backups',
    default: './backups',
  },
  restore: {
    alias: 'r',
    type: 'string',
    description: 'Restore from backup file',
  },
  list: {
    alias: 'l',
    type: 'boolean',
    description: 'List available backups',
    default: false,
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

export const handler = async (argv: Arguments<BackupOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    const backupDir = argv.output || './backups'

    // List backups
    if (argv.list) {
      if (!existsSync(backupDir)) {
        logger.info(chalk.yellow('No backup directory found.'))
        return
      }

      const backups = readdirSync(backupDir)
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
          const filePath = join(backupDir, file)
          const stats = statSync(filePath)
          return {
            name: file,
            size: stats.size,
            created: stats.mtime,
          }
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime())

      if (backups.length === 0) {
        logger.info(chalk.yellow('No backups found.'))
        return
      }

      logger.log(chalk.bold('\n📦 Available Backups:\n'))
      backups.forEach((backup) => {
        logger.log(`${chalk.cyan(backup.name)}`)
        logger.log(`  ${chalk.dim('Created:')} ${backup.created.toLocaleString()}`)
        logger.log(`  ${chalk.dim('Size:')} ${(backup.size / 1024).toFixed(1)} KB`)
        logger.log('')
      })
      return
    }

    // Restore from backup
    if (argv.restore) {
      const restorePath = argv.restore.startsWith('/') ? argv.restore : join(backupDir, argv.restore)

      if (!existsSync(restorePath)) {
        logger.error(`Backup file not found: ${restorePath}`)
        process.exit(1)
      }

      const backupConfig = await getConfig(restorePath, { validate: false })
      const outputPath = argv.config || 'vercel-firewall.config.json'

      if (existsSync(outputPath)) {
        const overwrite = await prompt(`Config file ${outputPath} already exists. Do you want to overwrite it?`, {
          type: 'confirm',
        })

        if (!overwrite) {
          logger.info(chalk.yellow('Restore cancelled.'))
          return
        }
      }

      await saveConfig(backupConfig, outputPath)
      logger.success(chalk.green(`✅ Restored configuration from ${restorePath} to ${outputPath}`))
      return
    }

    // Create backup
    const config = await getConfig(argv.config, { validate: false, throwOnError: false })

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

      logger.start('Fetching current remote configuration...')
      const remoteConfig = await client.fetchFirewallConfig()

      // Create backup directory if it doesn't exist
      if (!existsSync(backupDir)) {
        mkdirSync(backupDir, { recursive: true })
      }

      // Generate backup filename with timestamp
      const timestamp =
        new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] +
        '_' +
        new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0]
      const backupFilename = `firewall-backup-${timestamp}.json`
      const backupPath = join(backupDir, backupFilename)

      // Create backup config with metadata
      const backupConfig: FirewallConfig & { backup: { createdAt: string; source: string } } = {
        ...remoteConfig,
        backup: {
          createdAt: new Date().toISOString(),
          source: 'remote',
          projectId,
          teamId,
          originalVersion: remoteConfig.version,
        },
      }

      await saveConfig(backupConfig, backupPath)

      logger.success(chalk.green(`✅ Backup created: ${backupPath}`))
      logger.log('')
      logger.log(chalk.bold('Backup Details:'))
      logger.log(`${chalk.dim('Version:')} ${remoteConfig.version}`)
      logger.log(`${chalk.dim('Rules:')} ${remoteConfig.rules.length} custom, ${remoteConfig.ips.length} IP blocking`)
      logger.log(`${chalk.dim('Created:')} ${new Date().toLocaleString()}`)
      logger.log('')
      logger.log(chalk.dim('To restore this backup later, run:'))
      logger.log(chalk.cyan(`vercel-doorman backup --restore ${backupFilename}`))
      return
    }

    // New multi-provider code path
    logger.debug('Using multi-provider code path')

    const provider = await getProviderInstance({
      provider: argv.provider as ProviderType | undefined,
      config,
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

    const providerName = getProviderDisplayName(provider.name)
    logger.debug(`Using provider: ${providerName}`)

    logger.start(`Fetching current remote configuration from ${providerName}...`)
    const unifiedConfig = await provider.fetchConfig()

    // Convert unified format to Vercel format for backup compatibility
    const { RuleTranslator } = await import('../lib/translators/RuleTranslator')
    const rules = unifiedConfig.rules.map((rule) => RuleTranslator.unifiedToVercel(rule).result)
    const ips = (unifiedConfig.ips || []).map((ip) => ({
      ...ip,
      hostname: ip.hostname || '',
    }))

    const remoteConfig = {
      projectId: config.projectId || '',
      teamId: config.teamId || '',
      version: unifiedConfig.metadata?.version,
      updatedAt: unifiedConfig.metadata?.updatedAt,
      rules,
      ips,
    }

    // Create backup directory if it doesn't exist
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }

    // Generate backup filename with timestamp and provider
    const timestamp =
      new Date().toISOString().replace(/[:.]/g, '-').split('T')[0] +
      '_' +
      new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0]
    const backupFilename = `firewall-backup-${provider.name}-${timestamp}.json`
    const backupPath = join(backupDir, backupFilename)

    // Create backup config with metadata
    const backupConfig: FirewallConfig & { backup: { createdAt: string; source: string; provider: string } } = {
      ...remoteConfig,
      backup: {
        createdAt: new Date().toISOString(),
        source: 'remote',
        provider: provider.name,
        projectId: config.projectId,
        teamId: config.teamId,
        originalVersion: unifiedConfig.metadata?.version,
      },
    }

    await saveConfig(backupConfig, backupPath)

    logger.success(chalk.green(`✅ Backup created: ${backupPath}`))
    logger.log('')
    logger.log(chalk.bold('Backup Details:'))
    logger.log(`${chalk.dim('Provider:')} ${providerName}`)
    if (unifiedConfig.metadata?.version) {
      logger.log(`${chalk.dim('Version:')} ${unifiedConfig.metadata.version}`)
    }
    logger.log(`${chalk.dim('Rules:')} ${rules.length} custom, ${ips.length} IP blocking`)
    logger.log(`${chalk.dim('Created:')} ${new Date().toLocaleString()}`)
    logger.log('')
    logger.log(chalk.dim('To restore this backup later, run:'))
    logger.log(chalk.cyan(`vercel-doorman backup --restore ${backupFilename}`))
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error creating backup:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
