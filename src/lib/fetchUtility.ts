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
    const response = await fetch(this.getUrl(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({
        action: rule.id ? 'rules.update' : 'rules.insert',
        id: rule.id || null,
        value: rule,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error updating firewall rule: ${response.statusText}\n${error}`)
    }
  }

  async deleteFirewallRule(ruleId: string): Promise<void> {
    const response = await fetch(this.getUrl(), {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify({
        action: 'rules.delete',
        id: ruleId,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Error deleting firewall rule: ${response.statusText}\n${error}`)
    }
  }
}
