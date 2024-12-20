import { Template } from '../types'

export const blockOfacSanctionedCountries: Template = {
  metadata: {
    title: 'Block OFAC-Sanctioned Countries',
    reference: 'https://vercel.com/templates/other/block-ofac-sanctioned-countries-firewall-rule',
  },
  config: {
    rules: [
      {
        id: 'rule_block_traffic_from_ofac_sanctioned_countries',
        name: 'Block traffic from OFAC-sanctioned countries',
        description:
          'Blocks traffic from OFAC-sanctioned countries and enforces a one-hour persistent block after the first violation.',
        conditionGroup: [
          {
            conditions: [
              {
                type: 'geo_country',
                op: 'inc',
                value: ['SY', 'IR', 'RU', 'CU', 'KP'],
              },
            ],
          },
        ],
        action: {
          mitigate: {
            action: 'deny',
            actionDuration: '1h',
          },
        },
        active: true,
      },
    ],
  },
}
