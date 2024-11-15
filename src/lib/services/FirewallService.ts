import { VercelClient } from '../fetchUtility'
import { RuleTransformer } from '../transformers/RuleTransformer'
import { ConfigRule, FirewallConfig } from '../types/configTypes'
import { VercelRule } from '../types/vercelTypes'

export class FirewallService {
  constructor(private client: VercelClient) {}

  async syncRules(config: FirewallConfig): Promise<void> {
    const existingRules = await this.client.fetchFirewallRules()
    const configRules = config.rules

    // Convert existing rules to config format for comparison
    const existingConfigRules = existingRules.map(RuleTransformer.fromVercelRule)

    // Find rules to add, update, and delete
    const { toAdd, toUpdate, toDelete } = this.diffRules(configRules, existingConfigRules, existingRules)

    // Delete rules that are no longer in config
    for (const rule of toDelete) {
      await this.client.deleteFirewallRule(rule.id!)
    }

    // Add new rules
    for (const rule of toAdd) {
      const vercelRule = RuleTransformer.toVercelRule(rule)
      await this.client.updateFirewallRule(vercelRule)
    }

    // Update existing rules
    for (const rule of toUpdate) {
      await this.client.updateFirewallRule(rule)
    }
  }

  private diffRules(
    configRules: ConfigRule[],
    existingConfigRules: ConfigRule[],
    existingVercelRules: VercelRule[],
  ): {
    toAdd: ConfigRule[]
    toUpdate: VercelRule[]
    toDelete: VercelRule[]
  } {
    const toAdd: ConfigRule[] = []
    const toUpdate: VercelRule[] = []
    const toDelete = [...existingVercelRules]

    for (const configRule of configRules) {
      // Find matching rule by name
      const existingIndex = existingConfigRules.findIndex((r) => r.name === configRule.name)

      if (existingIndex === -1) {
        // Rule doesn't exist, add it
        toAdd.push(configRule)
      } else {
        const existingRule = existingConfigRules[existingIndex]
        const existingVercelRule = existingVercelRules[existingIndex]

        if (existingVercelRule) {
          // Remove from delete list since we found it
          const deleteIndex = toDelete.findIndex((r) => r.id === existingVercelRule.id)
          if (deleteIndex !== -1) {
            toDelete.splice(deleteIndex, 1)
          }
        }

        // Check if rule needs updating
        if (existingRule && this.hasRuleChanged(configRule, existingRule)) {
          const updatedRule = RuleTransformer.toVercelRule(configRule)
          if (existingVercelRule) {
            updatedRule.id = existingVercelRule.id
          }
          toUpdate.push(updatedRule)
        }
      }
    }

    return { toAdd, toUpdate, toDelete }
  }

  private hasRuleChanged(configRule: ConfigRule, existingRule: ConfigRule): boolean {
    return (
      configRule.active !== existingRule.active ||
      configRule.action !== existingRule.action ||
      configRule.type !== existingRule.type ||
      configRule.description !== existingRule.description ||
      JSON.stringify(configRule.values.sort()) !== JSON.stringify(existingRule.values.sort())
    )
  }
}
