import { logger } from '../logger'
import type { IFirewallProvider, ProviderType } from './IFirewallProvider'

/**
 * Provider factory function type
 */
export type ProviderFactory = () => IFirewallProvider | Promise<IFirewallProvider>

/**
 * Registry for managing firewall provider instances
 * Implements singleton pattern to ensure providers are instantiated once
 */
export class ProviderRegistry {
  private static instance: ProviderRegistry
  private providers: Map<ProviderType, IFirewallProvider> = new Map()
  private factories: Map<ProviderType, ProviderFactory> = new Map()

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry()
    }
    return ProviderRegistry.instance
  }

  /**
   * Register a provider factory
   * @param providerType - The provider type
   * @param factory - Factory function to create the provider
   */
  public register(providerType: ProviderType, factory: ProviderFactory): void {
    logger.debug(`Registering provider factory: ${providerType}`)
    this.factories.set(providerType, factory)
  }

  /**
   * Register a provider instance directly
   * @param providerType - The provider type
   * @param provider - The provider instance
   */
  public registerInstance(providerType: ProviderType, provider: IFirewallProvider): void {
    logger.debug(`Registering provider instance: ${providerType}`)
    this.providers.set(providerType, provider)
  }

  /**
   * Get a provider instance
   * Creates the provider if it doesn't exist using the registered factory
   * @param providerType - The provider type to get
   * @returns The provider instance
   * @throws Error if provider is not registered
   */
  public async get(providerType: ProviderType): Promise<IFirewallProvider> {
    // Return existing instance if available
    if (this.providers.has(providerType)) {
      return this.providers.get(providerType)!
    }

    // Create new instance using factory
    const factory = this.factories.get(providerType)
    if (!factory) {
      throw new Error(
        `Provider '${providerType}' is not registered. Available providers: ${this.getAvailableProviders().join(', ')}`,
      )
    }

    logger.debug(`Creating provider instance: ${providerType}`)
    const provider = await factory()
    this.providers.set(providerType, provider)
    return provider
  }

  /**
   * Get a provider synchronously (assumes it's already instantiated)
   * @param providerType - The provider type to get
   * @returns The provider instance or undefined
   */
  public getSync(providerType: ProviderType): IFirewallProvider | undefined {
    return this.providers.get(providerType)
  }

  /**
   * Check if a provider is registered
   * @param providerType - The provider type to check
   */
  public has(providerType: ProviderType): boolean {
    return this.factories.has(providerType) || this.providers.has(providerType)
  }

  /**
   * Get list of available provider types
   */
  public getAvailableProviders(): ProviderType[] {
    return Array.from(new Set([...this.factories.keys(), ...this.providers.keys()]))
  }

  /**
   * Clear all registered providers (mainly for testing)
   */
  public clear(): void {
    this.providers.clear()
    this.factories.clear()
  }

  /**
   * Unregister a provider
   * @param providerType - The provider type to unregister
   */
  public unregister(providerType: ProviderType): void {
    this.providers.delete(providerType)
    this.factories.delete(providerType)
    logger.debug(`Unregistered provider: ${providerType}`)
  }
}

// Export singleton instance getter for convenience
export const getProviderRegistry = (): ProviderRegistry => ProviderRegistry.getInstance()
