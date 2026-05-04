import { CloudflareFirewallService } from './CloudflareFirewallService'
import type { IFirewallProvider } from '../IFirewallProvider'

/**
 * Cloudflare Provider Factory
 * Creates a configured CloudflareFirewallService instance
 */
export class CloudflareProvider {
  /**
   * Create a Cloudflare provider instance
   */
  public static create(apiToken?: string, zoneId?: string, accountId?: string): IFirewallProvider {
    // Get credentials from environment if not provided
    const token = apiToken || process.env.CLOUDFLARE_API_TOKEN
    const zone = zoneId || process.env.CLOUDFLARE_ZONE_ID
    const account = accountId || process.env.CLOUDFLARE_ACCOUNT_ID

    if (!token) {
      throw new Error(
        'Cloudflare API token is required. Set CLOUDFLARE_API_TOKEN environment variable or pass as parameter.',
      )
    }

    if (!zone) {
      throw new Error(
        'Cloudflare Zone ID is required. Set CLOUDFLARE_ZONE_ID environment variable or pass as parameter.',
      )
    }

    return new CloudflareFirewallService(token, zone, account)
  }

  /**
   * Create from environment variables
   */
  public static fromEnv(): IFirewallProvider {
    return this.create()
  }

  /**
   * Create from configuration
   */
  public static fromConfig(config: { apiToken?: string; zoneId?: string; accountId?: string }): IFirewallProvider {
    return this.create(config.apiToken, config.zoneId, config.accountId)
  }
}
