import { BaseFirewallClient } from '../BaseFirewallClient'
import { logger } from '../../logger'
import type {
  CloudflareRuleset,
  CloudflareAPIResponse,
  CloudflareCreateRulesetRequest,
  CloudflareUpdateRulesetRequest,
  CloudflareCreateRuleRequest,
  CloudflareUpdateRuleRequest,
  CloudflareList,
  CloudflareListItem,
  CloudflareCreateListRequest,
  CloudflareUpdateListRequest,
  CloudflareAddListItemsRequest,
  CloudflareRemoveListItemsRequest,
  CloudflareListItemsResponse,
} from '../../types/cloudflare'

/**
 * Cloudflare API Client
 * Implements Cloudflare Ruleset Engine API operations
 */
export class CloudflareClient extends BaseFirewallClient {
  private readonly apiToken: string
  private readonly zoneId: string
  private readonly accountId?: string

  constructor(apiToken: string, zoneId: string, accountId?: string) {
    super('https://api.cloudflare.com/client/v4', 'cloudflare')
    this.apiToken = apiToken
    this.zoneId = zoneId
    this.accountId = accountId
  }

  /**
   * Get authentication headers
   */
  protected getAuthHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiToken}`,
    }
  }

  /**
   * List all rulesets for the zone
   */
  public async listRulesets(): Promise<CloudflareRuleset[]> {
    logger.debug(`Fetching rulesets for zone ${this.zoneId}`)

    const response = await this.get<CloudflareAPIResponse<CloudflareRuleset[]>>(`/zones/${this.zoneId}/rulesets`)

    if (!response.success) {
      throw new Error(`Failed to list rulesets: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    return response.result
  }

  /**
   * Get a specific ruleset by ID
   */
  public async getRuleset(rulesetId: string): Promise<CloudflareRuleset> {
    logger.debug(`Fetching ruleset ${rulesetId}`)

    const response = await this.get<CloudflareAPIResponse<CloudflareRuleset>>(
      `/zones/${this.zoneId}/rulesets/${rulesetId}`,
    )

    if (!response.success) {
      throw new Error(`Failed to get ruleset: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    return response.result
  }

  /**
   * Create a new ruleset
   */
  public async createRuleset(ruleset: CloudflareCreateRulesetRequest): Promise<CloudflareRuleset> {
    logger.debug(`Creating ruleset: ${ruleset.name}`)

    const response = await this.post<CloudflareAPIResponse<CloudflareRuleset>>(
      `/zones/${this.zoneId}/rulesets`,
      ruleset,
    )

    if (!response.success) {
      throw new Error(`Failed to create ruleset: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Created ruleset: ${response.result.name} (${response.result.id})`)
    return response.result
  }

  /**
   * Update an entire ruleset (creates new version)
   */
  public async updateRuleset(rulesetId: string, ruleset: CloudflareUpdateRulesetRequest): Promise<CloudflareRuleset> {
    logger.debug(`Updating ruleset ${rulesetId}`)

    const response = await this.put<CloudflareAPIResponse<CloudflareRuleset>>(
      `/zones/${this.zoneId}/rulesets/${rulesetId}`,
      ruleset,
    )

    if (!response.success) {
      throw new Error(`Failed to update ruleset: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Updated ruleset to version ${response.result.version}`)
    return response.result
  }

  /**
   * Delete a ruleset
   */
  public async deleteRuleset(rulesetId: string): Promise<void> {
    logger.debug(`Deleting ruleset ${rulesetId}`)

    const response = await this.delete<CloudflareAPIResponse<void>>(`/zones/${this.zoneId}/rulesets/${rulesetId}`)

    if (!response.success) {
      throw new Error(`Failed to delete ruleset: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Deleted ruleset ${rulesetId}`)
  }

  /**
   * Add a rule to a ruleset
   */
  public async createRule(rulesetId: string, rule: CloudflareCreateRuleRequest): Promise<CloudflareRuleset> {
    logger.debug(`Adding rule to ruleset ${rulesetId}`)

    const response = await this.post<CloudflareAPIResponse<CloudflareRuleset>>(
      `/zones/${this.zoneId}/rulesets/${rulesetId}/rules`,
      rule,
    )

    if (!response.success) {
      throw new Error(`Failed to create rule: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Added rule to ruleset ${rulesetId}`)
    return response.result
  }

  /**
   * Update a specific rule in a ruleset
   */
  public async updateRule(
    rulesetId: string,
    ruleId: string,
    rule: CloudflareUpdateRuleRequest,
  ): Promise<CloudflareRuleset> {
    logger.debug(`Updating rule ${ruleId} in ruleset ${rulesetId}`)

    const response = await this.patch<CloudflareAPIResponse<CloudflareRuleset>>(
      `/zones/${this.zoneId}/rulesets/${rulesetId}/rules/${ruleId}`,
      rule,
    )

    if (!response.success) {
      throw new Error(`Failed to update rule: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Updated rule ${ruleId}`)
    return response.result
  }

  /**
   * Delete a rule from a ruleset
   */
  public async deleteRule(rulesetId: string, ruleId: string): Promise<CloudflareRuleset> {
    logger.debug(`Deleting rule ${ruleId} from ruleset ${rulesetId}`)

    const response = await this.delete<CloudflareAPIResponse<CloudflareRuleset>>(
      `/zones/${this.zoneId}/rulesets/${rulesetId}/rules/${ruleId}`,
    )

    if (!response.success) {
      throw new Error(`Failed to delete rule: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Deleted rule ${ruleId}`)
    return response.result
  }

  /**
   * Get or create a custom firewall ruleset
   * Finds existing custom firewall ruleset or creates a new one
   */
  public async getOrCreateFirewallRuleset(): Promise<CloudflareRuleset> {
    logger.debug('Looking for existing custom firewall ruleset')

    const rulesets = await this.listRulesets()
    const existingRuleset = rulesets.find((rs) => rs.kind === 'custom' && rs.phase === 'http_request_firewall_custom')

    if (existingRuleset) {
      logger.debug(`Found existing ruleset: ${existingRuleset.id}`)
      return existingRuleset
    }

    // Create new ruleset
    logger.info('No existing custom firewall ruleset found, creating new one')
    return this.createRuleset({
      name: 'Doorman Custom Firewall Rules',
      kind: 'custom',
      phase: 'http_request_firewall_custom',
      description: 'Custom firewall rules managed by Vercel Doorman',
      rules: [],
    })
  }

  /**
   * Verify API credentials and connectivity
   */
  public async verifyCredentials(): Promise<boolean> {
    try {
      logger.debug('Verifying Cloudflare credentials')

      // Try to list rulesets - if this succeeds, credentials are valid
      await this.listRulesets()

      logger.info('Cloudflare credentials verified successfully')
      return true
    } catch (error) {
      logger.error(`Cloudflare credential verification failed: ${error}`)
      return false
    }
  }

  /**
   * Get zone information
   */
  public async getZoneInfo(): Promise<{ id: string; name: string }> {
    const response = await this.get<CloudflareAPIResponse<{ id: string; name: string }>>(`/zones/${this.zoneId}`)

    if (!response.success) {
      throw new Error(`Failed to get zone info: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    return response.result
  }

  /**
   * Cloudflare Lists API
   * Lists are used for bulk IP management
   */

  /**
   * List all Lists (account-level)
   */
  public async listLists(): Promise<CloudflareList[]> {
    logger.debug('Fetching Cloudflare Lists')

    if (!this.accountId) {
      logger.warn('Account ID not provided, Lists API requires account-level access')
      return []
    }

    const response = await this.get<CloudflareAPIResponse<CloudflareList[]>>(`/accounts/${this.accountId}/rules/lists`)

    if (!response.success) {
      throw new Error(`Failed to list Lists: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    return response.result
  }

  /**
   * Get a specific List by ID
   */
  public async getList(listId: string): Promise<CloudflareList> {
    logger.debug(`Fetching List ${listId}`)

    if (!this.accountId) {
      throw new Error('Account ID required for Lists API')
    }

    const response = await this.get<CloudflareAPIResponse<CloudflareList>>(
      `/accounts/${this.accountId}/rules/lists/${listId}`,
    )

    if (!response.success) {
      throw new Error(`Failed to get List: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    return response.result
  }

  /**
   * Create a new List
   */
  public async createList(list: CloudflareCreateListRequest): Promise<CloudflareList> {
    logger.debug(`Creating List: ${list.name}`)

    if (!this.accountId) {
      throw new Error('Account ID required for Lists API')
    }

    const response = await this.post<CloudflareAPIResponse<CloudflareList>>(
      `/accounts/${this.accountId}/rules/lists`,
      list,
    )

    if (!response.success) {
      throw new Error(`Failed to create List: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Created List: ${response.result.name} (${response.result.id})`)
    return response.result
  }

  /**
   * Update a List
   */
  public async updateList(listId: string, list: CloudflareUpdateListRequest): Promise<CloudflareList> {
    logger.debug(`Updating List ${listId}`)

    if (!this.accountId) {
      throw new Error('Account ID required for Lists API')
    }

    const response = await this.put<CloudflareAPIResponse<CloudflareList>>(
      `/accounts/${this.accountId}/rules/lists/${listId}`,
      list,
    )

    if (!response.success) {
      throw new Error(`Failed to update List: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Updated List ${listId}`)
    return response.result
  }

  /**
   * Delete a List
   */
  public async deleteList(listId: string): Promise<void> {
    logger.debug(`Deleting List ${listId}`)

    if (!this.accountId) {
      throw new Error('Account ID required for Lists API')
    }

    const response = await this.delete<CloudflareAPIResponse<void>>(`/accounts/${this.accountId}/rules/lists/${listId}`)

    if (!response.success) {
      throw new Error(`Failed to delete List: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Deleted List ${listId}`)
  }

  /**
   * Get all items in a List
   */
  public async getListItems(listId: string): Promise<CloudflareListItem[]> {
    logger.debug(`Fetching items from List ${listId}`)

    if (!this.accountId) {
      throw new Error('Account ID required for Lists API')
    }

    const response = await this.get<CloudflareListItemsResponse>(
      `/accounts/${this.accountId}/rules/lists/${listId}/items`,
    )

    if (!response.success) {
      throw new Error(`Failed to get List items: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    return response.result
  }

  /**
   * Add items to a List
   */
  public async addListItems(listId: string, request: CloudflareAddListItemsRequest): Promise<CloudflareListItem[]> {
    logger.debug(`Adding ${request.items.length} items to List ${listId}`)

    if (!this.accountId) {
      throw new Error('Account ID required for Lists API')
    }

    const response = await this.post<CloudflareListItemsResponse>(
      `/accounts/${this.accountId}/rules/lists/${listId}/items`,
      request.items,
    )

    if (!response.success) {
      throw new Error(`Failed to add items to List: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Added ${request.items.length} items to List ${listId}`)
    return response.result
  }

  /**
   * Remove items from a List
   */
  public async removeListItems(listId: string, request: CloudflareRemoveListItemsRequest): Promise<void> {
    logger.debug(`Removing ${request.items.length} items from List ${listId}`)

    if (!this.accountId) {
      throw new Error('Account ID required for Lists API')
    }

    const response = await this.delete<CloudflareAPIResponse<void>>(
      `/accounts/${this.accountId}/rules/lists/${listId}/items`,
      {
        body: JSON.stringify(request),
      },
    )

    if (!response.success) {
      throw new Error(`Failed to remove items from List: ${response.errors.map((e) => e.message).join(', ')}`)
    }

    logger.info(`Removed ${request.items.length} items from List ${listId}`)
  }

  /**
   * Get or create a List for IP blocking
   * Finds existing "Doorman IP Blocklist" or creates one
   */
  public async getOrCreateIPBlocklist(): Promise<CloudflareList> {
    logger.debug('Looking for existing Doorman IP blocklist')

    if (!this.accountId) {
      logger.warn('Account ID not provided, cannot use Lists for IP blocking')
      throw new Error('Account ID required for IP Lists')
    }

    const lists = await this.listLists()
    const existingList = lists.find((list) => list.name === 'Doorman IP Blocklist' && list.kind === 'ip')

    if (existingList) {
      logger.debug(`Found existing IP blocklist: ${existingList.id}`)
      return existingList
    }

    // Create new list
    logger.info('No existing IP blocklist found, creating new one')
    return this.createList({
      name: 'Doorman IP Blocklist',
      description: 'IP addresses blocked by Vercel Doorman',
      kind: 'ip',
    })
  }
}
