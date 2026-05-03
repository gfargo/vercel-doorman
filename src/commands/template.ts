import chalk from 'chalk'
import { LogLevels } from 'consola'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { firewallConfigSchema } from '../lib/schemas/firewallSchemas'
import { TemplateName, getTemplateConfig, templates } from '../lib/templates'
import { FirewallConfig } from '../lib/types'
import { prompt } from '../lib/ui/prompt'
import { getConfig, saveConfig } from '../lib/utils/config'
import { handleCommandError } from '../lib/utils/handleCommandError'

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
      logger.error(`Template not found: ${templateName}`)
      process.exit(1)
    }

    logger.debug('Template content:', templateConfig)

    // Load config without validation — we're about to modify it,
    // so we validate the result instead of the input.
    logger.start('Loading current configuration...')
    const config = await getConfig(undefined, 'raw')

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

    // Validate the resulting config before saving
    const validationResult = firewallConfigSchema.safeParse(updatedConfig)
    if (!validationResult.success) {
      logger.error(chalk.red('The resulting configuration would be invalid:'))
      validationResult.error.errors.forEach((err) => {
        const path = err.path.join('.')
        logger.error(chalk.red(`  - ${path}: ${err.message}`))
      })
      logger.info(chalk.dim('Template was not applied. Fix the issues above and try again.'))
      process.exit(1)
    }

    logger.start('Saving updated configuration...')
    await saveConfig(updatedConfig, undefined, { validate: false })
    logger.success(chalk.green(`Successfully added template '${templateName}' to configuration`))
  } catch (error) {
    handleCommandError(error, 'adding template')
  }
}
