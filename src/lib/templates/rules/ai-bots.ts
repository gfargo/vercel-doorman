import { Template } from '../types'

export const aiBots: Template = {
  metadata: {
    title: 'Block AI Bots Firewall Rule',
    reference: 'https://vercel.com/templates/other/block-ai-bots-firewall-rule',
  },
  config: {
    rules: [
      {
        id: 'rule_detect_ai_bots',
        name: 'Detect AI Bots',
        description: '',
        conditionGroup: [
          {
            conditions: [
              {
                type: 'user_agent',
                op: 're',
                value:
                  'AI2Bot|Ai2Bot-Dolma|Amazonbot|Applebot|Applebot-Extended|Bytespider|CCBot|ChatGPT-User|Claude-Web|ClaudeBot|Diffbot|FacebookBot|FriendlyCrawler|GPTBot|Google-Extended|GoogleOther|GoogleOther-Image|GoogleOther-Video|ICC-Crawler|ImagesiftBot|Meta-ExternalAgent|Meta-ExternalFetcher|OAI-SearchBot|PerplexityBot|PetalBot|Scrapy|Timpibot|VelenPublicWebCrawler|Webzio-Extended|YouBot|anthropic-ai|cohere-ai|facebookexternalhit|img2dataset|omgili|omgilibot',
              },
            ],
          },
        ],
        action: {
          mitigate: {
            action: 'log',
          },
        },
        active: true,
      },
    ],
  },
}
