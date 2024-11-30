import chalk from 'chalk'
import { LogLevels } from 'consola'
import { readFileSync, writeFileSync } from 'fs'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallConfig } from '../lib/schemas/firewallSchemas'
import { FirewallService } from '../lib/services/FirewallService'
import { ValidationService } from '../lib/services/ValidationService'
import { VercelClient } from '../lib/services/VercelClient'
import { prompt } from '../lib/ui/prompt'
import { displayIPBlockingTable, displayRulesTable, RULE_STATUS_MAP } from '../lib/ui/table'
import { ConfigFinder } from '../lib/utils/configFinder'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { promptForCredentials } from '../lib/utils/promptForCredentials'

interface SyncOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  debug?: boolean
}

export const command = 'sync'
export const desc = 'Sync Vercel Firewall rules with config file'

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

export const handler = async (argv: Arguments<SyncOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    // Find and read config file
    let configPath = argv.config
    if (!configPath) {
      configPath = await ConfigFinder.findConfig()
      if (!configPath) {
        throw new Error(
          `No config file found. Create ${ConfigFinder.getDefaultConfigPath()} or specify path with --config`,
        )
      }
    }

    // Read, parse, and validate config file
    const configContent = readFileSync(configPath, 'utf8')
    const configJson = JSON.parse(configContent)

    const validator: ValidationService = ValidationService.getInstance()
    validator.validateConfig(configJson)
    let config: FirewallConfig = configJson

    const { token, projectId, teamId } = await promptForCredentials({
      token: argv.token,
      projectId: argv.projectId || config.projectId,
      teamId: argv.teamId || config.teamId,
    })

    const client = new VercelClient(projectId, teamId, token)
    const service = new FirewallService(client)

    logger.start(chalk.magenta('Calculating firewall configuration changes...'))
    const { toAdd, toUpdate, toDelete, ipsToAdd, ipsToUpdate, ipsToDelete, version } = await service.getChanges(config)

    const hasCustomRuleChanges = toAdd.length > 0 || toUpdate.length > 0 || toDelete.length > 0
    const hasIPRuleChanges = ipsToAdd.length > 0 || ipsToUpdate.length > 0 || ipsToDelete.length > 0
    const hasVersionChange = config.version !== version

    if (!hasCustomRuleChanges && !hasIPRuleChanges && !hasVersionChange) {
      logger.success(chalk.green('No changes detected. Firewall rules are in sync.'))
      return
    }

    if (hasCustomRuleChanges) {
      logger.log(chalk.bold('\nProposed Custom Rule Changes:\n'))
      displayRulesTable(
        [
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ...toAdd.map((rule: any) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id as string })),
          ...toUpdate.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.modified, id: rule.id as string })),
          ...toDelete.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.deleted, id: rule.id as string })),
        ],
        { showStatus: true },
      )
    }

    if (hasIPRuleChanges) {
      logger.log(chalk.bold('\nProposed IP Blocking Rule Changes:\n'))
      displayIPBlockingTable(
        [
          ...ipsToAdd.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id || undefined })),
          ...ipsToUpdate.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.modified, id: rule.id || undefined })),
          ...ipsToDelete.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.deleted, id: rule.id || undefined })),
        ],
        { showStatus: true },
      )
    }

    if (hasVersionChange) {
      logger.log(chalk.bold('\nProposed Metadata Changes:\n'))
      logger.log(`  - Version: ${chalk.red(config.version)} ${chalk.dim('->')} ${chalk.green(version)}`)
    }

    const confirmed = await prompt('Do you want to apply these changes?', { type: 'confirm' })
    if (!confirmed) {
      logger.info(chalk.yellow('Sync cancelled.'))
      return
    }

    logger.start('Starting firewall rules sync...')

    // Create backup of original config
    const backupConfig = JSON.parse(JSON.stringify(config)) as FirewallConfig

    // Perform sync operation
    const syncResult = await service.syncRules(config, {
      debug: argv.debug,
    })
    const { rulesToUpdateLocally } = syncResult
    logger.success('Firewall rules sync completed successfully')

    // Validate and update config metadata
    try {
      const updatedConfig = await service.validateAndUpdateConfig(config, syncResult, { dryRun: false })
      config = updatedConfig // Update our working copy
    } catch (error) {
      logger.error('Failed to validate sync result or update config metadata')
      logger.error(error instanceof Error ? error.message : String(error))

      // Write backup to config file
      writeFileSync(configPath, JSON.stringify(backupConfig, null, 2))

      logger.info(chalk.yellow('Restored original config due to validation failure'))
      throw new Error('Sync validation failed - original config restored')
    }

    if (rulesToUpdateLocally.length > 0) {
      logger.log('')
      logger.info(chalk.yellow('Some rules have IDs that do not match their expected snake_case name:'))
      rulesToUpdateLocally.forEach((rule) => {
        logger.log(
          `  - Rule "${rule.name}": ${chalk.red(rule.oldId || 'empty')} ${chalk.dim('->')} ${chalk.green(rule.newId)}`,
        )
      })

      const updateConfirmed = await prompt('Do you want to update the local config with the new IDs?', {
        type: 'confirm',
      })

      if (updateConfirmed) {
        // Update config with new IDs and preserve metadata
        const updatedConfig: FirewallConfig = {
          ...config,
          rules: config.rules.map((rule) => {
            const ruleToUpdate = rulesToUpdateLocally.find(
              (r) => r.oldId === rule.id || (r.oldId === '' && r.name === rule.name),
            )
            return ruleToUpdate ? { ...rule, id: ruleToUpdate.newId } : rule
          }),
          // Preserve IP blocking rules
          ips: config.ips || [],
        }

        writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2))
        logger.success('Local config updated with new rule IDs')
      } else {
        logger.info(chalk.yellow('Local config not updated. Remember to update rule IDs manually if needed.'))
      }
    } else if (backupConfig.version !== config.version) {
      writeFileSync(configPath, JSON.stringify(config, null, 2))
      logger.success('Local config updated with new version and metadata')
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else if (error instanceof Error && error.name === 'ValidationError') {
      logger.error(error)
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error syncing firewall rules:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
