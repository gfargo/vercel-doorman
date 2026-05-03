import { LogLevels } from 'consola'
import { logger } from '../logger'
import { FirewallService } from '../services/FirewallService'
import { VercelClient } from '../services/VercelClient'
import { FirewallConfig } from '../types'
import { promptForCredentials } from '../ui/promptForCredentials'
import { getConfig } from './config'
import { handleCommandError } from './handleCommandError'

/**
 * Context provided to command handlers by `withCredentials`.
 */
export interface CommandContext {
  config: FirewallConfig
  client: VercelClient
  service: FirewallService
  token: string
  projectId: string
  teamId: string
}

/**
 * Options controlling how `withCredentials` loads config and resolves credentials.
 */
export interface WithCredentialsOptions {
  /** CLI --config path */
  config?: string
  /** CLI --projectId override */
  projectId?: string
  /** CLI --teamId override */
  teamId?: string
  /** CLI --token override */
  token?: string
  /** CLI --debug flag */
  debug?: boolean
  /**
   * If true, config file is optional — missing/invalid configs are silently
   * ignored and an empty partial config is used for credential resolution.
   * Use for commands like `list` and `download` that can work without a local config.
   */
  optionalConfig?: boolean
  /**
   * If true, config is loaded without schema validation.
   * Use for commands like `download` that need to read projectId/teamId
   * from a potentially incomplete config.
   */
  skipValidation?: boolean
  /** Context string for error messages (e.g., 'syncing firewall rules') */
  errorContext: string
}

/**
 * Shared middleware that handles the common credential resolution pattern:
 * 1. Enable debug logging if requested
 * 2. Load config (required or optional)
 * 3. Resolve credentials from CLI args → config → env vars → interactive prompt
 * 4. Create VercelClient and FirewallService
 * 5. Call the handler with the resolved context
 * 6. Catch and format errors consistently
 */
export async function withCredentials(
  options: WithCredentialsOptions,
  handler: (ctx: CommandContext) => Promise<void>,
): Promise<void> {
  try {
    if (options.debug) {
      logger.level = LogLevels.debug
    }

    let config: FirewallConfig

    if (options.optionalConfig) {
      try {
        config = await getConfig(options.config, {
          validate: !options.skipValidation,
          throwOnError: false,
        })
      } catch {
        config = {} as FirewallConfig
      }
    } else {
      config = await getConfig(options.config, {
        validate: !options.skipValidation,
      })
    }

    const { token, projectId, teamId } = await promptForCredentials({
      token: options.token,
      projectId: options.projectId || config.projectId,
      teamId: options.teamId || config.teamId,
    })

    const client = new VercelClient(projectId, teamId, token)
    const service = new FirewallService(client)

    await handler({ config, client, service, token, projectId, teamId })
  } catch (error) {
    handleCommandError(error, options.errorContext)
  }
}
