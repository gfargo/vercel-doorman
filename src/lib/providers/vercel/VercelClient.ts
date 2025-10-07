import chalk from 'chalk'
import { logger } from '../../logger'
import { CustomRule, IPBlockingRule } from '../../types/vercel'
import type { FirewallConfig } from '../../types'
import { prompt } from '../../ui/prompt'
import { createEmptyConfig } from '../../utils/createEmptyConfig'
import { BaseFirewallClient } from '../BaseFirewallClient'

export type ApiResponse = LatestConfigResponse | TargetVersionConfig

export type TargetVersionConfig = VercelConfig

export type LatestConfigResponse = {
  active: VercelConfig
}

export interface VercelConfig {
  version: number
  id: string
  firewallEnabled: boolean
  crs: unknown // TODO: Add type for CRS, this is an enterprise feature and less clear how to interact with :(
  rules: CustomRule[]
  ips: IPBlockingRule[]
  projectKey: string
  ownerId: string
  updatedAt: string
}

export const VERCEL_API_BASE_URL = 'https://api.vercel.com/v1/security/firewall/config'

/**
 * A client for interacting with the Vercel API to manage firewall rules.
 */
export class VercelClient extends BaseFirewallClient {
  /**
   * Creates an instance of VercelClient.
   * @param projectId - The ID of the Vercel project.
   * @param teamId - The ID of the Vercel team.
   * @param token - The authentication token for the Vercel API.
   */
  constructor(
    private projectId: string,
    private teamId: string,
    private token: string,
  ) {
    // No static base path because URLs are constructed per-request with query params
    super('', 'vercel')
  }

  /**
   * Generates the headers required for the Vercel API requests.
   * @returns An object containing the headers.
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
    }
  }

  /**
   * Constructs the URL for the Vercel API requests.
   * @returns The constructed URL.
   */
  private getUrl(configVersion?: number): string {
    const baseUrl = configVersion !== undefined ? `${VERCEL_API_BASE_URL}/${configVersion}` : VERCEL_API_BASE_URL
    logger.debug('API URL:', baseUrl)
    return `${baseUrl}?projectId=${this.projectId}&teamId=${this.teamId}`
  }

  // Note: response handling is centralized in BaseFirewallClient.makeRequest

  /**
   * Fetches the firewall config for the Vercel project.
   * @param configVersion - Optional version number to fetch a specific config version
   * @returns A promise that resolves to the firewall config.
   * @throws An error if the fetch request fails.
   */
  async fetchFirewallConfig(configVersion?: number): Promise<VercelConfig> {
    const response = await this.get<ApiResponse>(this.getUrl(configVersion))

    logger.debug('Config Version:', configVersion ?? 'latest')
    logger.debug('Fetched Config:', configVersion ? response : (response as LatestConfigResponse).active)

    if (configVersion) {
      return response as TargetVersionConfig
    }

    if (!response || ('active' in response && response.active === null)) {
      logger.warn(chalk.bold('No firewall configuration found.'))
      const createEmptyFirstVersion = await prompt('Would you like to create one?', {
        type: 'confirm',
      })

      if (createEmptyFirstVersion) {
        logger.debug('Creating new empty firewall configuration...')
        const initialVersion = await this.putEmptyConfig()
        logger.debug('Empty firewall configuration created successfully')
        logger.debug(`New configuration version: ${chalk.yellow(initialVersion.version)}`)

        return initialVersion
      } else {
        return (response as LatestConfigResponse).active
      }
    }

    return (response as LatestConfigResponse).active
  }

  async putEmptyConfig(): Promise<VercelConfig> {
    const { $schema, ...emptyConfig } = createEmptyConfig()
    logger.debug('Empty Config:', emptyConfig)
    return this.putConfig(emptyConfig)
  }

  async putConfig(config: FirewallConfig): Promise<VercelConfig> {
    const response = await this.put<LatestConfigResponse>(this.getUrl(), config)
    return response.active
  }

  /**
   * Fetches the active firewall rules for the Vercel project.
   * @returns A promise that resolves to an array of CustomRule objects.
   * @throws An error if the fetch request fails.
   */
  async fetchActiveFirewallRules(): Promise<CustomRule[]> {
    const data = await this.fetchFirewallConfig()
    return data?.rules
  }

  /**
   * Updates an existing firewall rule or creates a new one if the rule ID is not provided.
   * @param rule - The CustomRule object to update or create.
   * @returns A promise that resolves to the updated or created CustomRule object.
   * @throws An error if the update or create request fails.
   */
  async updateFirewallRule(rule: CustomRule): Promise<CustomRule> {
    const isNewRule = !rule.id || rule.id === '-'
    const body = {
      action: isNewRule ? 'rules.insert' : 'rules.update',
      id: isNewRule ? null : rule.id,
      value: {
        name: rule.name,
        description: rule.description,
        action: rule.action,
        conditionGroup: rule.conditionGroup,
        active: rule.active,
      },
    }

    return this.patch<CustomRule>(this.getUrl(), body)
  }

  /**
   * Creates a new firewall rule.
   * @param rule - The CustomRule object to create, without the ID.
   * @returns A promise that resolves to the created CustomRule object.
   * @throws An error if the create request fails.
   */
  async createFirewallRule(rule: Omit<CustomRule, 'id'>): Promise<CustomRule> {
    return this.updateFirewallRule({ ...rule, id: '-' } as CustomRule)
  }

  /**
   * Deletes an existing firewall rule.
   * @param rule - The CustomRule object to delete.
   * @returns A promise that resolves when the rule is deleted.
   * @throws An error if the delete request fails.
   */
  async deleteFirewallRule(rule: CustomRule): Promise<void> {
    const body = {
      action: 'rules.remove',
      id: rule.id,
      value: null,
    }

    await this.patch<void>(this.getUrl(), body)
  }

  /**
   * Updates an existing IP blocking rule or creates a new one if the rule ID is not provided.
   */
  async updateIPBlockingRule(rule: IPBlockingRule): Promise<IPBlockingRule> {
    const isNewRule = !rule.id || rule.id === '-'
    const body = {
      action: isNewRule ? 'ip.insert' : 'ip.update',
      id: isNewRule ? null : rule.id,
      value: {
        action: rule.action,
        hostname: rule.hostname,
        ip: rule.ip,
        ...(rule.notes && { notes: rule.notes }),
      },
    }

    return this.patch<IPBlockingRule>(this.getUrl(), body)
  }

  /**
   * Creates a new IP blocking rule.
   */
  async createIPBlockingRule(rule: Omit<IPBlockingRule, 'id'>): Promise<IPBlockingRule> {
    return this.updateIPBlockingRule({ ...rule, id: '-' })
  }

  /**
   * Deletes an existing IP blocking rule.
   */
  async deleteIPBlockingRule(rule: IPBlockingRule): Promise<void> {
    const body = {
      action: 'ip.remove',
      id: rule.id,
      value: null,
    }

    await this.patch<void>(this.getUrl(), body)
  }

  /**
   * Verify credentials are valid by attempting to fetch config
   */
  async verifyCredentials(): Promise<boolean> {
    try {
      await this.fetchFirewallConfig()
      return true
    } catch (error) {
      logger.debug('Credential verification failed:', error)
      return false
    }
  }
}
