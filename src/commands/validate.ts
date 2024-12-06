import type { ErrorObject } from 'ajv'
import chalk from 'chalk'
import { Arguments } from 'yargs'
import { ZodError } from 'zod'
import { logger } from '../lib/logger'
import { firewallConfigSchema } from '../lib/schemas/firewallSchemas'
import { ValidationError, ValidationService } from '../lib/services/ValidationService'
import { getConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'

interface ValidateOptions {
  config?: string
  verbose?: boolean
}

export const command = 'validate'
export const desc = 'Validate firewall configuration file'

export const builder = {
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path to firewall config file (defaults to vercel-firewall.config.json)',
  },
  verbose: {
    alias: 'v',
    type: 'boolean',
    description: 'Show detailed validation results',
    default: false,
  },
}

export const handler = async (argv: Arguments<ValidateOptions>) => {
  try {
    // Load config without validation since we'll do that ourselves
    const configJson = await getConfig(argv.config, { validate: false })
    const validator: ValidationService = ValidationService.getInstance()

    if (argv.verbose) {
      logger.start('Validating configuration file...\n')
    }

    // Run Zod validation first
    const zodResult = firewallConfigSchema.safeParse(configJson)
    if (argv.verbose) {
      logger.log(chalk.bold.underline('Zod Schema Validation:'))
      if (zodResult.success) {
        logger.log(chalk.green('✓ Schema validation passed'))
      } else {
        logger.error(chalk.red('✗ Schema validation failed:'))
        zodResult.error.errors.forEach((err) => {
          const path = err.path.join('.')
          logger.error(chalk.red(`  - ${path}: ${err.message}`))
        })
      }
    }

    // Run AJV validation
    let ajvValid = true
    let ajvErrors: ErrorObject[] = []
    try {
      validator.validateConfig(configJson)
      if (argv.verbose) {
        logger.log(chalk.bold.underline('\nAJV Schema Validation:'))
        logger.log(chalk.green('✓ JSON Schema validation passed'))
      }
    } catch (error) {
      ajvValid = false
      if (error instanceof ValidationError) {
        ajvErrors = error.ajvErrors || []
        if (argv.verbose) {
          logger.log(chalk.bold.underline('\nAJV Schema Validation:'))
          logger.error(chalk.red('✗ JSON Schema validation failed:'))
          ajvErrors.forEach((err) => {
            logger.error(chalk.red(`  - ${err.instancePath}: ${err.message}`))
          })
        }
      } else {
        throw error
      }
    }

    // Run custom validations if both schema validations pass
    if (zodResult.success && ajvValid) {
      if (argv.verbose) {
        logger.log(chalk.bold.underline('\nCustom Validations:'))
        const config = zodResult.data

        // Rule name uniqueness
        const names = new Set<string>()
        const duplicates = new Set<string>()
        for (const rule of config.rules) {
          if (names.has(rule.name)) {
            duplicates.add(rule.name)
          }
          names.add(rule.name)
        }

        logger.log(`${chalk.cyan.dim('\nRule Names:')}`)
        if (duplicates.size > 0) {
          logger.error(chalk.red('✗ Duplicate rule names found:'))
          duplicates.forEach((name) => logger.error(chalk.red(`  - "${name}"`)))
        } else {
          logger.log(chalk.green('✓ All rule names are unique'))
        }

        logger.log('') // Empty line before final message
      }
    }

    // Final result
    if (zodResult.success && ajvValid) {
      logger.success(chalk.green('Configuration is valid'))
    } else {
      throw new Error('Configuration validation failed')
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else if (error instanceof Error && error.name === 'ValidationError') {
      // AJV validation error
      logger.error(error)
    } else if (error instanceof ZodError) {
      // Zod validation error
      logger.error(chalk.red('Schema validation failed:'))
      error.errors.forEach((err) => {
        const path = err.path.join('.')
        logger.error(chalk.red(`  - ${path}: ${err.message}`))
      })
    } else {
      logger.error(
        ErrorFormatter.wrapErrorBlock([
          'Error validating configuration:',
          `  ${error instanceof Error ? error.message : String(error)}`,
        ]),
      )
    }
    process.exit(1)
  }
}
