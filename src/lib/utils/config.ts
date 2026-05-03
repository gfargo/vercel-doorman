import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname } from 'path'
import { logger } from '../logger'
import { ValidationService } from '../services/ValidationService'
import { FirewallConfig, isUnifiedConfig } from '../types'
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
    // If explicit path was provided but file doesn't exist and caller doesn't want errors, return empty
    if (configPath && !existsSync(filePath)) {
      if (!options.throwOnError) {
        return {} as unknown as FirewallConfig
      }
    }

    const configContent = readFileSync(filePath, 'utf8')
    const configJson = JSON.parse(configContent)

    // Validate config if requested
    if (options.validate) {
      try {
        // Skip v1 validation for unified (v2) configs
        if (!isUnifiedConfig(configJson)) {
          const validator: ValidationService = ValidationService.getInstance()
          validator.validateConfig(configJson)
        }
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

  // Create backup of existing config to prevent corruption
  let backupPath: string | null = null
  if (existsSync(filePath)) {
    backupPath = `${filePath}.backup.${Date.now()}`
    try {
      const existingContent = readFileSync(filePath, 'utf8')
      writeFileSync(backupPath, existingContent)
      logger.debug(`Created backup at ${backupPath}`)
    } catch (backupError) {
      logger.warn(`Failed to create backup: ${backupError instanceof Error ? backupError.message : String(backupError)}`)
      // Continue without backup - better to save than fail completely
    }
  }

  try {
    // Serialize config with error handling
    let configJson: string
    try {
      configJson = JSON.stringify(config, null, 2)
    } catch (serializationError) {
      throw new Error(`Failed to serialize configuration: ${serializationError instanceof Error ? serializationError.message : String(serializationError)}`)
    }

    // Validate JSON before writing
    try {
      JSON.parse(configJson)
    } catch (parseError) {
      throw new Error(`Generated invalid JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`)
    }

    // Write config atomically using temporary file
    const tempPath = `${filePath}.tmp.${Date.now()}`
    try {
      writeFileSync(tempPath, configJson)
      
      // Verify the written file is valid
      const writtenContent = readFileSync(tempPath, 'utf8')
      JSON.parse(writtenContent) // Throws if invalid
      
      // Atomic move to final location
      if (existsSync(filePath)) {
        // On Windows, we need to remove the target file first
        if (process.platform === 'win32') {
          const fs = require('fs')
          fs.unlinkSync(filePath)
        }
      }
      
      const fs = require('fs')
      fs.renameSync(tempPath, filePath)
      
      logger.debug(`Config saved to ${filePath}`)
      
      // Clean up backup after successful write
      if (backupPath && existsSync(backupPath)) {
        try {
          fs.unlinkSync(backupPath)
          logger.debug(`Cleaned up backup ${backupPath}`)
        } catch (cleanupError) {
          logger.debug(`Failed to clean up backup: ${cleanupError}`)
          // Not critical - leave backup file
        }
      }
      
    } catch (writeError) {
      // Clean up temp file
      if (existsSync(tempPath)) {
        try {
          const fs = require('fs')
          fs.unlinkSync(tempPath)
        } catch {
          // Ignore cleanup errors
        }
      }
      throw writeError
    }
    
  } catch (saveError) {
    // Restore from backup if save failed and backup exists
    if (backupPath && existsSync(backupPath)) {
      try {
        const backupContent = readFileSync(backupPath, 'utf8')
        writeFileSync(filePath, backupContent)
        logger.info(`Restored configuration from backup due to save failure`)
      } catch (restoreError) {
        logger.error(`Failed to restore from backup: ${restoreError instanceof Error ? restoreError.message : String(restoreError)}`)
      }
    }
    
    throw new Error(`Failed to save configuration: ${saveError instanceof Error ? saveError.message : String(saveError)}`)
  }
}
