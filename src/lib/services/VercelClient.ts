import { logger } from '../logger'
import { VercelIPBlockingRule, VercelRule } from '../types/vercelTypes'

export interface ApiResponse {
  active: {
    version: number
    firewallEnabled: boolean
    crs: unknown
    rules: VercelRule[]
    ips: VercelIPBlockingRule[]
    ownerId: string
    updatedAt: string
    id: string
    projectKey: string
  }
}
export const VERCEL_API_BASE_URL = 'https://api.vercel.com/v1/security/firewall/config'

/**
 * A client for interacting with the Vercel API to manage firewall rules.
 */
export class VercelClient {
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
  ) {}

  /**
   * Generates the headers required for the Vercel API requests.
   * @returns An object containing the headers.
   */
  private getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
  }

  /**
   * Constructs the URL for the Vercel API requests.
   * @returns The constructed URL.
   */
  private getUrl(version?: number) {
    const baseUrl = version !== undefined ? `${VERCEL_API_BASE_URL}/${version}` : VERCEL_API_BASE_URL
    return `${baseUrl}?projectId=${this.projectId}&teamId=${this.teamId}`
  }

  /**
   * Handles the response from the Vercel API.
   * @param response - The response object from the fetch request.
   * @param isNewRule - A boolean indicating if the rule is new.
   * @returns A promise that resolves to a VercelRule object.
   * @throws An error if the response is not ok.
   */
  private async handleResponse(response: Response, isNewRule: boolean): Promise<VercelRule> {
    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error ${isNewRule ? 'creating' : 'updating'} firewall rule: ${response.statusText}\n${error}`)
    }

    return (await response.json()) as VercelRule
  }

  /**
   * Fetches the active firewall config for the Vercel project.
   * @returns A promise that resolves to the active firewall config.
   * @throws An error if the fetch request fails.
   */
  async fetchActiveFirewallConfig(): Promise<ApiResponse['active']> {
    const response = await fetch(this.getUrl(), {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error fetching firewall rules: ${response.statusText}\n${error}`)
    }

    const data = (await response.json()) as ApiResponse

    logger.debug('fetchActiveFirewallConfig:::', { config: data.active })

    return data.active
  }

  /**
   * Fetches the active firewall rules for the Vercel project.
   * @returns A promise that resolves to an array of VercelRule objects.
   * @throws An error if the fetch request fails.
   */
  async fetchActiveFirewallRules(): Promise<VercelRule[]> {
    const data = await this.fetchActiveFirewallConfig()
    return data.rules
  }

  /**
   * Updates an existing firewall rule or creates a new one if the rule ID is not provided.
   * @param rule - The VercelRule object to update or create.
   * @returns A promise that resolves to the updated or created VercelRule object.
   * @throws An error if the update or create request fails.
   */
  async updateFirewallRule(rule: VercelRule): Promise<VercelRule> {
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

    const response = await fetch(this.getUrl(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error ${isNewRule ? 'creating' : 'updating'} firewall rule: ${response.statusText}\n${error}`)
    }

    return this.handleResponse(response, isNewRule)
  }

  /**
   * Creates a new firewall rule.
   * @param rule - The VercelRule object to create, without the ID.
   * @returns A promise that resolves to the created VercelRule object.
   * @throws An error if the create request fails.
   */
  async createFirewallRule(rule: Omit<VercelRule, 'id'>): Promise<VercelRule> {
    return this.updateFirewallRule({ ...rule, id: '-' } as VercelRule)
  }

  /**
   * Deletes an existing firewall rule.
   * @param rule - The VercelRule object to delete.
   * @returns A promise that resolves when the rule is deleted.
   * @throws An error if the delete request fails.
   */
  async deleteFirewallRule(rule: VercelRule): Promise<void> {
    const body = JSON.stringify({
      action: 'rules.remove',
      id: rule.id,
      value: null,
    })

    const response = await fetch(this.getUrl(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error deleting firewall rule: ${response.statusText}\n${error}`)
    }
  }

  /**
   * Updates an existing IP blocking rule or creates a new one if the rule ID is not provided.
   */
  async updateIPBlockingRule(rule: VercelIPBlockingRule): Promise<VercelIPBlockingRule> {
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

    const response = await fetch(this.getUrl(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error ${isNewRule ? 'creating' : 'updating'} IP blocking rule: ${response.statusText}\n${error}`)
    }

    return (await response.json()) as VercelIPBlockingRule
  }

  /**
   * Creates a new IP blocking rule.
   */
  async createIPBlockingRule(rule: Omit<VercelIPBlockingRule, 'id'>): Promise<VercelIPBlockingRule> {
    return this.updateIPBlockingRule({ ...rule, id: '-' })
  }

  /**
   * Deletes an existing IP blocking rule.
   */
  async deleteIPBlockingRule(rule: VercelIPBlockingRule): Promise<void> {
    const body = JSON.stringify({
      action: 'ip.remove',
      id: rule.id,
      value: null,
    })

    const response = await fetch(this.getUrl(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body,
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error deleting IP blocking rule: ${response.statusText}\n${error}`)
    }
  }
}
