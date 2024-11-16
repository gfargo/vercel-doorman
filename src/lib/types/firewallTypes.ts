// Define the structure for a Vercel Firewall Rule
export interface FirewallRule {
  id: string
  action: 'allow' | 'deny'
  source: string
  destination?: string
  protocol?: 'tcp' | 'udp' | 'icmp'
  port?: number
  description?: string
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

// Define the structure for the Firewall Configuration
export interface FirewallConfig {
  rules: FirewallRule[]
}
