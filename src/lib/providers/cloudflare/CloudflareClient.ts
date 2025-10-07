import { BaseFirewallClient } from '../BaseFirewallClient'
import { logger } from '../../logger'
import type {
  CloudflareRuleset,
  CloudflareAPIResponse,
  CloudflareCreateRulesetRequest,
  CloudflareUpdateRulesetRequest,
  CloudflareCreateRuleRequest,
  CloudflareUpdateRuleRequest,
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
}
