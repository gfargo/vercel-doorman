import chalk from 'chalk'
import { readFileSync, writeFileSync } from 'fs'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallService } from '../lib/services/FirewallService'
import { ValidationService } from '../lib/services/ValidationService'
import { VercelClient } from '../lib/services/VercelClient'
import { FirewallConfig } from '../lib/types/configTypes'
import { prompt } from '../lib/ui/prompt'
import { displayRulesTable, RULE_STATUS_MAP } from '../lib/ui/table'
import { ConfigFinder } from '../lib/utils/configFinder'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

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
    const token = argv.token || process.env.VERCEL_TOKEN
    if (!token) {
      throw new Error('No Vercel token provided. Use --token or set VERCEL_TOKEN environment variable')
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
    const config: FirewallConfig = configJson

    const projectId = argv.projectId || config.projectId
    const teamId = argv.teamId || config.teamId

    if (!projectId) {
      throw new Error('No Project ID provided. Use --projectId or set in config file')
    }

    if (!teamId) {
      throw new Error('No Team ID provided. Use --teamId or set in config file')
    }

    const client = new VercelClient(projectId, teamId, token)
    const service = new FirewallService(client)

    logger.start('Calculating firewall rule changes...')
    const { toAdd, toUpdate, toDelete } = await service.getChanges(config)

    if (toAdd.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
      logger.success('No changes detected. Firewall rules are in sync.')
      return
    }

    logger.log(chalk.bold('\nProposed Firewall Rule Changes:\n'))
    displayRulesTable(
      [
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...toAdd.map((rule: any) => ({ ...rule, changeStatus: RULE_STATUS_MAP.new, id: rule.id as string })),
        ...toUpdate.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.modified, id: rule.id as string })),
        ...toDelete.map((rule) => ({ ...rule, changeStatus: RULE_STATUS_MAP.deleted, id: rule.id as string })),
      ],
      { showStatus: true },
    )

    const confirmed = await prompt('Do you want to apply these changes?', { type: 'confirm' })
    if (!confirmed) {
      logger.info(chalk.yellow('Sync cancelled.'))
      return
    }

    logger.start('Starting firewall rules sync...')
    const { rulesToUpdateLocally } = await service.syncRules(config, {
      debug: argv.debug,
    })
    logger.success('Firewall rules sync completed successfully')

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
        // Update config with new IDs
        const updatedConfig: FirewallConfig = {
          ...config,
          rules: config.rules.map((rule) => {
            const ruleToUpdate = rulesToUpdateLocally.find(
              (r) => r.oldId === rule.id || (r.oldId === '' && r.name === rule.name),
            )
            return ruleToUpdate ? { ...rule, id: ruleToUpdate.newId } : rule
          }),
        }

        writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2))
        logger.success('Local config updated with new rule IDs')
      } else {
        logger.info(chalk.yellow('Local config not updated. Remember to update rule IDs manually if needed.'))
      }
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
