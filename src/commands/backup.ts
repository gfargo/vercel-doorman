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

interface BackupOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  output?: string
  restore?: string
  list?: boolean
  debug?: boolean
}

export const command = 'backup'
export const desc = 'Backup or restore firewall configurations'

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
    const config = await getConfig(argv.config)

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
