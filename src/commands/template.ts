import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { TemplateName, getTemplateConfig, templates } from '../lib/templates'
import { FirewallConfig } from '../lib/types'
import { prompt } from '../lib/ui/prompt'
import { getConfig, saveConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

interface TemplateOptions {
  name?: string
  dryRun?: boolean
  debug?: boolean
}

export const command = 'template [name]'
export const desc = 'Add a firewall rule template to your configuration'

export const builder = {
  name: {
    type: 'string',
    description: 'Name of the template to add',
  },
  dryRun: {
    alias: 'd',
    type: 'boolean',
    description: 'Preview changes without applying them',
    default: false,
  },
  debug: {
    type: 'boolean',
    description: 'Enable debug logging',
    default: false,
  },
}

const getAvailableTemplates = (): TemplateName[] => {
  return Object.keys(templates) as TemplateName[]
}

export const handler = async (argv: Arguments<TemplateOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    logger.debug('Template command arguments:', argv)

    // Get template name from argument or prompt
    let templateName = argv.name
    if (!templateName) {
      const templates = getAvailableTemplates()
      const selected = await prompt('Select a template to add:', {
        type: 'select',
        options: templates,
        initial: templates[0],
      })
      templateName = selected as string
    }

    const templateConfig = getTemplateConfig(templateName as TemplateName)
    if (!templateConfig) {
      logger.error(ErrorFormatter.wrapErrorBlock(['Template not found:', `  ${templateName}`]))
      process.exit(1)
    }

    try {
      logger.debug('Template content:', templateConfig)

      // Load config, allowing invalid configs to be loaded
      logger.start('Loading current configuration...')
      const config = await getConfig(undefined, { validate: true, throwOnError: false })

      if (argv.dryRun) {
        logger.info(chalk.cyan('\nDry run - The following rules would be added:'))
        logger.log(JSON.stringify(templateConfig.rules, null, 2))
        return
      }

      // Append the new rules to the existing configuration
      const updatedConfig: FirewallConfig = {
        ...config,
        rules: [...config.rules, ...templateConfig.rules],
      }

      // Save config with validation enabled and throwing on error
      logger.start('Saving updated configuration...')
      await saveConfig(updatedConfig, undefined, { validate: true, throwOnError: true })
      logger.success(chalk.green(`Successfully added template '${templateName}' to configuration`))
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.error(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in template file:', `  ${error.message}`]))
      } else {
        logger.error(
          ErrorFormatter.wrapErrorBlock([
            'Error adding template:',
            `  ${error instanceof Error ? error.message : String(error)}`,
          ]),
        )
      }
      process.exit(1)
    }
  } catch (error) {
    logger.error(
      ErrorFormatter.wrapErrorBlock([
        'Unexpected error:',
        `  ${error instanceof Error ? error.message : String(error)}`,
      ]),
    )
    process.exit(1)
  }
}
