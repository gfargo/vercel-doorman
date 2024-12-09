import { aiBots } from './rules/ai-bots'
import { badBots } from './rules/bad-bots'
import { blockOfacSanctionedCountries } from './rules/block-ofac-sanctioned-countries'
import { wordpress } from './rules/wordpress'
import { TemplateCollection } from './types'

export const templates: TemplateCollection = {
  'ai-bots': aiBots,
  'bad-bots': badBots,
  'block-ofac-sanctioned-countries': blockOfacSanctionedCountries,
  wordpress: wordpress,
} as const

export type TemplateName = keyof typeof templates

export const getTemplateMetadata = (name: TemplateName) => templates[name]?.metadata
export const getTemplateConfig = (name: TemplateName) => templates[name]?.config

export * from './types'
