interface TemplateMetadata {
  title: string
  reference: string
}

export const templatesMetadata: Record<string, TemplateMetadata> = {
  'bad-bots': {
    title: 'Block Bad Bots Firewall Rule',
    reference: 'https://vercel.com/templates/other/block-bad-bots-firewall-rule',
  },
  'block-ofac-sanctioned-countries': {
    title: 'Block OFAC-Sanctioned Countries',
    reference: 'https://vercel.com/templates/other/block-ofac-sanctioned-countries-firewall-rule',
  },
  wordpress: {
    title: 'Deny Common WordPress URLs Firewall Rule',
    reference: 'https://vercel.com/templates/other/block-wordpress-urls-firewall-rule',
  },
  'ai-bots': {
    title: 'Block AI Bots Firewall Rule',
    reference: 'https://vercel.com/templates/other/block-ai-bots-firewall-rule',
  },
}
