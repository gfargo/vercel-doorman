import { FirewallConfig } from '../types'

export interface TemplateMetadata {
  title: string
  reference: string
}

export interface Template {
  metadata: TemplateMetadata
  config: FirewallConfig
}

export type TemplateCollection = {
  [K in string]: Template
}
