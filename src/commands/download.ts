import chalk from 'chalk'
import { Arguments } from 'yargs'
import { z } from 'zod'
import { logger } from '../lib/logger'
import { configVersionSchema } from '../lib/schemas/firewallSchemas'
import { FirewallConfig, IPBlockingRule } from '../lib/types'
import { prompt } from '../lib/ui/prompt'
import { displayIPBlockingTable, displayRulesTable } from '../lib/ui/table'
import { saveConfig } from '../lib/utils/config'
import { withCredentials } from '../lib/utils/withCredentials'

interface DownloadOptions {
  config?: string
  projectId?: string
  teamId?: string
  token?: string
  dryRun?: boolean
  debug?: boolean
  configVersion?: number
}

export const command = 'download [configVersion]'
export const desc =
  'Download remote Vercel Firewall rules and update local config, optionally for a specific configuration version'

export const builder = {
  configVersion: {
    type: 'number',
    description: 'Specific configuration version to download (defaults to latest)',
  },
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
  dryRun: {
    alias: 'd',
    type: 'boolean',
    description: 'Show rules that would be downloaded without making changes',
    default: false,
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
}

export const handler = async (argv: Arguments<DownloadOptions>) => {
  await withCredentials(
    {
      config: argv.config,
      projectId: argv.projectId,
      teamId: argv.teamId,
      token: argv.token,
      debug: argv.debug,
      optionalConfig: true,
      skipValidation: true,
      errorContext: 'downloading firewall rules',
    },
    async ({ config: existingConfig, client, projectId, teamId }) => {
      // Validate version if provided
      if (argv.configVersion !== undefined) {
        try {
          configVersionSchema.parse(argv.configVersion)
        } catch (error) {
          if (error instanceof z.ZodError) {
            logger.error('Invalid configuration version number. Version must be a positive integer.')
            process.exit(1)
          }
          throw error
        }
      }

      logger.start(
        `Fetching remote firewall configuration${argv.configVersion ? ` version ${argv.configVersion}` : ''} ...`,
      )
      const remoteConfig = await client.fetchFirewallConfig(argv.configVersion)

      const configRules = remoteConfig.rules
      const ipBlockingRules = remoteConfig.ips as IPBlockingRule[]

      if (configRules.length > 0) {
        logger.log(chalk.bold('\nRemote Custom Rules to Download:\n'))
        displayRulesTable(configRules, { showStatus: false })
      } else {
        logger.info('No custom rules to download...')
      }

      if (ipBlockingRules.length > 0) {
        logger.log(chalk.bold('\nRemote IP Blocking Rules to Download:\n'))
        displayIPBlockingTable(ipBlockingRules, { showStatus: false })
      } else {
        logger.info('No IP blocking rules to download...')
      }

      if (argv.dryRun) {
        logger.info(chalk.cyan('Dry run completed. No changes made.'))
        return
      }

      const confirmed = await prompt(
        `Do you want to download${argv.configVersion ? ` version ${argv.configVersion}` : ' the latest version'} of these rules? This will overwrite your local configuration.`,
        { type: 'confirm' },
      )
      if (!confirmed) {
        logger.info(chalk.yellow('Download cancelled.'))
        return
      }

      const newConfig: FirewallConfig = {
        ...existingConfig,
        projectId,
        teamId,
        version: remoteConfig.version,
        updatedAt: remoteConfig.updatedAt,
        rules: configRules,
        ips: ipBlockingRules,
      }

      logger.start(`Saving configuration with version: ${newConfig.version}`)
      await saveConfig(newConfig, argv.config)
      logger.success(chalk.green('Successfully downloaded and updated configuration'))
    },
  )
}
