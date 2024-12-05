import chalk from 'chalk'
import { LogLevels } from 'consola'
import fs from 'fs'
import path from 'path'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { FirewallConfig } from '../lib/schemas/firewallSchemas'
import { templatesMetadata } from '../lib/templates/metadata'
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

const listTemplates = () => {
  const templatesDir = 'src/lib/templates'
  const templates = fs
    .readdirSync(templatesDir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({
      name: path.basename(file, '.json'),
      path: path.join(templatesDir, file),
    }))

  logger.log(chalk.bold('\nAvailable Templates:'))
  templates.forEach((template) => {
    const metadata = templatesMetadata[template.name]
    logger.log(`\n${chalk.cyan(template.name)}`)
    if (metadata) {
      logger.log(chalk.dim(`Description: ${metadata.title}`))
      logger.log(chalk.dim(`Reference: ${metadata.reference}`))
    }
  })
}

export const handler = async (argv: Arguments<TemplateOptions>) => {
  try {
    if (argv.debug) {
      logger.level = LogLevels.debug
    }

    logger.debug('Template command arguments:', argv)

    // If no template name provided, show available templates
    if (!argv.name) {
      listTemplates()
      return
    }

    const templatesDir = 'src/lib/templates'
    const templatePath = path.join(templatesDir, `${argv.name}.json`)

    if (!fs.existsSync(templatePath)) {
      logger.error(ErrorFormatter.wrapErrorBlock(['Template not found:', `  ${argv.name}`, '', 'Available templates:']))
      listTemplates()
      process.exit(1)
    }

    try {
      const templateContent = JSON.parse(fs.readFileSync(templatePath, 'utf-8'))
      logger.debug('Template content:', templateContent)

      // Load config, allowing invalid configs to be loaded
      logger.start('Loading current configuration...')
      const config = await getConfig(undefined, { validate: true, throwOnError: false })

      if (argv.dryRun) {
        logger.info(chalk.cyan('\nDry run - The following rules would be added:'))
        logger.log(JSON.stringify(templateContent.rules, null, 2))
        return
      }

      // Append the new rules to the existing configuration
      const updatedConfig: FirewallConfig = {
        ...config,
        rules: [...config.rules, ...templateContent.rules],
      }

      // Save config with validation enabled and throwing on error
      logger.start('Saving updated configuration...')
      await saveConfig(updatedConfig, undefined, { validate: true, throwOnError: true })
      logger.success(chalk.green(`\n✓ Successfully added template '${argv.name}' to configuration`))
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
