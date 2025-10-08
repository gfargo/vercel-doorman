import type { ErrorObject } from 'ajv'
import chalk from 'chalk'
import { Arguments } from 'yargs'
import { ZodError } from 'zod'
import { logger } from '../lib/logger'
import { firewallConfigSchema } from '../lib/schemas/firewallSchemas'
import { isUnifiedConfig } from '../lib/types'
import { ValidationError, ValidationService } from '../lib/services/ValidationService'
import { getConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { getProviderInstance, getProviderDisplayName } from '../lib/utils/providerHelper'
import type { ProviderType } from '../lib/providers/IFirewallProvider'

interface ValidateOptions {
  config?: string
  provider?: 'vercel' | 'cloudflare'
  verbose?: boolean
  // Vercel options (for provider-specific validation)
  projectId?: string
  teamId?: string
  token?: string
  // Cloudflare options
  apiToken?: string
  zoneId?: string
  accountId?: string
  ci?: boolean
}

export const command = 'validate'
export const desc = 'Validate firewall configuration file with optional provider-specific checks'

export const builder = {
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path to firewall config file',
  },
  provider: {
    type: 'string',
    description:
      'Firewall provider for provider-specific validation (vercel or cloudflare) - auto-detected if not specified',
    choices: ['vercel', 'cloudflare'],
  },
  verbose: {
    alias: 'v',
    type: 'boolean',
    description: 'Show detailed validation results',
    default: false,
  },
  // Vercel options (optional, for connectivity check)
  projectId: {
    alias: 'p',
    type: 'string',
    description: 'Vercel Project ID (optional, for provider validation)',
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID (optional, for provider validation)',
  },
  token: {
    type: 'string',
    description: 'Vercel API token (optional, defaults to VERCEL_TOKEN env var)',
  },
  // Cloudflare options
  apiToken: {
    type: 'string',
    description: 'Cloudflare API token (optional, defaults to CLOUDFLARE_API_TOKEN env var)',
  },
  zoneId: {
    type: 'string',
    description: 'Cloudflare Zone ID (optional, defaults to CLOUDFLARE_ZONE_ID env var)',
  },
  accountId: {
    type: 'string',
    description: 'Cloudflare Account ID (optional, defaults to CLOUDFLARE_ACCOUNT_ID env var)',
  },
  ci: {
    type: 'boolean',
    description: 'Run in CI mode (non-interactive)',
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

    // Detect unified (v2) configs and skip v1 schema validation
    const isUnified = isUnifiedConfig(configJson)

    // Run Zod validation first (v1 only)
    let zodSuccess = true
    let zodErr: ZodError | null = null
    let zodData: unknown = null
    if (!isUnified) {
      const zr = firewallConfigSchema.safeParse(configJson)
      zodSuccess = zr.success
      if (zr.success) {
        zodData = zr.data
      } else {
        zodErr = zr.error
      }
    }
    if (argv.verbose) {
      logger.log(chalk.bold.underline('Zod Schema Validation:'))
      if (isUnified || zodSuccess) {
        logger.log(chalk.green('✓ Schema validation passed'))
      } else {
        logger.error(chalk.red('✗ Schema validation failed:'))
        zodErr?.errors.forEach((err) => {
          const path = err.path.join('.')
          logger.error(chalk.red(`  - ${path}: ${err.message}`))
        })
      }
    }

    // Run AJV validation
    let ajvValid = true
    let ajvErrors: ErrorObject[] = []
    if (!isUnified) {
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
    }

    // Run custom validations if both schema validations pass (v1 only)
    if ((isUnified || zodSuccess) && ajvValid) {
      if (argv.verbose) {
        logger.log(chalk.bold.underline('\nCustom Validations:'))
        if (!isUnified && zodData && typeof zodData === 'object' && zodData !== null) {
          const config = zodData as { rules: { name: string }[] }
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
    }

    // Provider-specific validation (optional)
    const configProvider = 'provider' in configJson ? configJson.provider : undefined
    if ((isUnified || (zodSuccess && ajvValid)) && (argv.provider || configProvider)) {
      if (argv.verbose) {
        logger.log(chalk.bold.underline('Provider-Specific Validation:'))
      }

      try {
        const provider = await getProviderInstance({
          provider: argv.provider as ProviderType | undefined,
          config: configJson,
          interactive: !argv.ci,
          // Vercel credentials (optional)
          token: argv.token,
          projectId: argv.projectId,
          teamId: argv.teamId,
          // Cloudflare credentials (optional)
          apiToken: argv.apiToken,
          zoneId: argv.zoneId,
          accountId: argv.accountId,
        })

        const providerName = getProviderDisplayName(provider.name)

        // Convert config to unified format if needed
        const { isUnifiedConfig } = await import('../lib/types')
        const { RuleTranslator } = await import('../lib/translators/RuleTranslator')
        let unifiedConfig

        if (isUnifiedConfig(configJson)) {
          unifiedConfig = configJson
        } else {
          // Convert legacy Vercel format to unified format
          const rules = configJson.rules.map((rule) => RuleTranslator.vercelToUnified(rule).result)
          const ips = (configJson.ips || []).map((ip) => RuleTranslator.vercelIPToUnified(ip))

          unifiedConfig = {
            version: '2.0',
            provider: provider.name,
            rules,
            ips,
            metadata: {
              version: configJson.version,
              updatedAt: configJson.updatedAt,
            },
          }
        }

        // Run provider validation
        const providerValidation = provider.validateConfig(unifiedConfig)

        if (argv.verbose) {
          logger.log(chalk.cyan(`\n${providerName} Compatibility Check:`))
        }

        if (providerValidation.valid) {
          if (argv.verbose) {
            logger.log(chalk.green(`✓ Configuration is compatible with ${providerName}`))
          }
        } else {
          if (argv.verbose) {
            logger.error(chalk.red(`✗ Configuration has ${providerName} compatibility issues:`))
            providerValidation.errors.forEach((err) => {
              logger.error(chalk.red(`  - ${err.path}: ${err.message}`))
            })
          }
        }

        if (providerValidation.warnings.length > 0 && argv.verbose) {
          logger.log(chalk.yellow(`\n⚠️  ${providerName} Warnings:`))
          providerValidation.warnings.forEach((warn) => {
            logger.warn(chalk.yellow(`  - ${warn.path}: ${warn.message}`))
          })
        }

        if (!providerValidation.valid) {
          throw new Error(`Configuration validation failed for ${providerName}`)
        }
      } catch (error) {
        if (argv.verbose) {
          logger.warn(chalk.yellow('Provider-specific validation skipped (credentials not provided or invalid)'))
          logger.debug(error instanceof Error ? error.message : String(error))
        }
      }
    }

    // Final result
    if ((isUnified || zodSuccess) && ajvValid) {
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
    if (!argv.ci) {
      process.exit(1)
    }
  }
}
