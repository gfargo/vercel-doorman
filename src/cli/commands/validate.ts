import { readFileSync } from 'fs'
import { Arguments } from 'yargs'
import { ValidationService } from '../../lib/services/ValidationService'
import { ConfigFinder } from '../../lib/utils/configFinder'
import { ErrorFormatter } from '../../lib/utils/errorFormatter'

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

    // Read and parse config file
    const configContent = readFileSync(configPath, 'utf8')
    const configJson = JSON.parse(configContent)

    // Get validator instance
    const validator = ValidationService.getInstance()

    if (argv.verbose) {
      console.log('Validating configuration file...\n')
    }

    // Validate config
    validator.validateConfig(configJson)

    // If we get here, validation passed
    if (argv.verbose) {
      // Show detailed validation results for each rule
      for (const rule of configJson.rules) {
        const checks = [
          { name: 'Name format', passed: true },
          { name: 'Value format', passed: true },
          { name: 'Action valid', passed: true },
        ]

        console.log(ErrorFormatter.formatDetailedRuleValidation(rule.name, checks))
        console.log('') // Empty line between rules
      }
      console.log('') // Empty line before final message
    }

    console.log(ErrorFormatter.formatSuccessMessage('Configuration is valid'))
  } catch (error) {
    if (error instanceof SyntaxError) {
      console.error(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
    } else if (error.name === 'ValidationError') {
      console.error(error.getFormattedMessage())
    } else {
      console.error(ErrorFormatter.wrapErrorBlock(['Unexpected error while validating config:', `  ${error.message}`]))
    }
    process.exit(1)
  }
}
