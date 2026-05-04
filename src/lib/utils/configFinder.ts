import { existsSync } from 'fs'
import { dirname, resolve } from 'path'

/**
 * Config file names in priority order.
 * `.doorman.json` is the new default; `vercel-firewall.config.json` is the legacy name.
 */
const CONFIG_FILE_NAMES = ['.doorman.json', 'vercel-firewall.config.json'] as const

export const DEFAULT_CONFIG_FILE_NAME = CONFIG_FILE_NAMES[0]

export class ConfigFinder {
  /**
   * Find the config file by looking in the current directory and walking up
   * the directory tree until we find it or hit the root.
   * Checks `.doorman.json` first, then falls back to `vercel-firewall.config.json`.
   */
  static async findConfig(startPath?: string): Promise<string | undefined> {
    const { findUp } = await import('find-up')

    for (const name of CONFIG_FILE_NAMES) {
      const configPath = await findUp(name, {
        cwd: startPath || process.cwd(),
      })
      if (configPath) return configPath
    }

    return undefined
  }

  /**
   * Get the project root directory (where the config file is located)
   */
  static async findProjectRoot(startPath?: string): Promise<string | null> {
    const configPath = await this.findConfig(startPath)
    return configPath ? dirname(configPath) : null
  }

  /**
   * Check if a config file exists at the specified path
   */
  static configExists(path: string): boolean {
    return existsSync(resolve(path))
  }

  /**
   * Get the default config path relative to the current directory.
   * Returns `.doorman.json` for new projects.
   */
  static getDefaultConfigPath(): string {
    return resolve(process.cwd(), DEFAULT_CONFIG_FILE_NAME)
  }

  /**
   * Get all supported config file names (for documentation/help text).
   */
  static getSupportedFileNames(): readonly string[] {
    return CONFIG_FILE_NAMES
  }
}
