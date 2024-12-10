import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { logger } from '../logger'
import { ValidationService } from '../services/ValidationService'
import { FirewallConfig } from '../types'
import { prompt } from '../ui/prompt'
import { ConfigFinder } from './configFinder'
import { createEmptyConfig } from './createEmptyConfig'

interface ConfigOptions {
  validate?: boolean // Whether to validate the config
  throwOnError?: boolean // Whether to throw on validation errors (if validate is true)
}

export async function getConfig(
  configPath?: string,
  options: ConfigOptions = { validate: true, throwOnError: true },
): Promise<FirewallConfig> {
  // Find config file
  const filePath = configPath || (await ConfigFinder.findConfig())
  if (!filePath) {
    const defaultPath = ConfigFinder.getDefaultConfigPath()
    const createNew = await prompt(`No config file found. Would you like to create one at ${defaultPath}?`, {
      type: 'confirm',
    })

    if (createNew) {
      logger.info(`Creating new config file at ${defaultPath}`)
      const emptyConfig = createEmptyConfig()
      await saveConfig(emptyConfig, defaultPath, { validate: false })
      return emptyConfig
    } else {
      throw new Error(
        `Config file is required to continue. Use --config to specify a custom path or manually create a config file at ${defaultPath}`,
      )
    }
  }

  // Read and parse config
  try {
    const configContent = readFileSync(filePath, 'utf8')
    const configJson = JSON.parse(configContent)

    // Validate config if requested
    if (options.validate) {
      try {
        const validator: ValidationService = ValidationService.getInstance()
        validator.validateConfig(configJson)
      } catch (validationError) {
        logger.error('Config validation failed:', validationError)
        if (options.throwOnError) {
          throw validationError
        }
      }
    }

    return configJson
  } catch (error) {
    if (error instanceof SyntaxError) {
      const message = `Invalid JSON format in config file: ${error.message}`
      logger.error(message)
      throw new Error(message)
    }
    throw error
  }
}

export async function saveConfig(
  config: FirewallConfig,
  configPath?: string,
  options: ConfigOptions = { validate: true, throwOnError: true },
): Promise<void> {
  const filePath = configPath || (await ConfigFinder.findConfig()) || ConfigFinder.getDefaultConfigPath()

  // Validate config before saving if requested
  if (options.validate) {
    try {
      const validator: ValidationService = ValidationService.getInstance()
      validator.validateConfig(config)
    } catch (validationError) {
      logger.error('Config validation failed:', validationError)
      if (options.throwOnError) {
        throw validationError
      }
    }
  }

  // Ensure directory exists
  const configDir = dirname(filePath)
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  // Write config
  writeFileSync(filePath, JSON.stringify(config, null, 2))
  logger.debug(`Config saved to ${filePath}`)
}
