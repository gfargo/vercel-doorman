// import fetch from 'node-fetch'
import { VercelRule } from './types/vercelTypes'

const VERCEL_API_BASE_URL = 'https://api.vercel.com/v1/security/firewall/config'

interface ApiResponse {
  active: {
    version: number
    firewallEnabled: boolean
    rules: VercelRule[]
    ownerId: string
    updatedAt: string
    id: string
    projectKey: string
  }
}

export class VercelClient {
  constructor(
    private projectId: string,
    private teamId: string,
    private token: string,
  ) {}

  private getHeaders() {
    return {
      Authorization: `Bearer ${this.token}`,
      'Content-Type': 'application/json',
    }
  }

  private getUrl() {
    return `${VERCEL_API_BASE_URL}?projectId=${this.projectId}&teamId=${this.teamId}`
  }

  async fetchFirewallRules(): Promise<VercelRule[]> {
    const response = await fetch(this.getUrl(), {
      method: 'GET',
      headers: this.getHeaders(),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error fetching firewall rules: ${response.statusText}\n${error}`)
    }

    const data = (await response.json()) as ApiResponse
    return data.active.rules
  }

  async updateFirewallRule(rule: VercelRule): Promise<void> {
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
  }

  async createFirewallRule(rule: Omit<VercelRule, 'id'>): Promise<void> {
    return this.updateFirewallRule({ ...rule, id: '-' } as VercelRule)
  }

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
}
