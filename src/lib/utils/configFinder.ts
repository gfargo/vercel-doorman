import { findUp } from 'find-up'
import { existsSync } from 'fs'
import { dirname, resolve } from 'path'

const CONFIG_FILE_NAME = 'vercel-firewall.config.json'
export class ConfigFinder {
  /**
   * Find the config file by looking in the current directory and walking up
   * the directory tree until we find it or hit the root
   */
  static async findConfig(startPath?: string): Promise<string | undefined> {
    const configPath = await findUp(CONFIG_FILE_NAME, {
      cwd: startPath || process.cwd(),
    })

    return configPath || undefined
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
   * Get the default config path relative to the current directory
   */
  static getDefaultConfigPath(): string {
    return resolve(process.cwd(), CONFIG_FILE_NAME)
  }
}
