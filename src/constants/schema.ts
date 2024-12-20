/**
 * THIS FILE IS AUTO-GENERATED - DO NOT EDIT
 *
 * Generated using ts-json-schema-generator
 * Run 'pnpm build:schema' to regenerate this file
 * Source: schema/generate-schema.ts
 */

export const SCHEMA_URL = 'https://doorman.griffen.codes/schema.json'

export const schema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Doorman Config',
  description: 'Schema for vercel-doorman project configuration files',
  $ref: '#/definitions/FirewallConfig',
  definitions: {
    FirewallConfig: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
        },
        teamId: {
          type: 'string',
        },
        $schema: {
          type: 'string',
        },
        version: {
          type: 'number',
        },
        firewallEnabled: {
          type: 'boolean',
        },
        rules: {
          type: 'array',
          items: {
            $ref: '#/definitions/CustomRule',
          },
        },
        ips: {
          type: 'array',
          items: {
            $ref: '#/definitions/IPBlockingRule',
          },
        },
        updatedAt: {
          type: 'string',
        },
      },
      required: ['rules'],
      additionalProperties: false,
      description: 'The main configuration type for Vercel Doorman',
    },
    CustomRule: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
        description: {
          type: 'string',
        },
        conditionGroup: {
          type: 'array',
          items: {
            $ref: '#/definitions/ConditionGroup',
          },
        },
        action: {
          $ref: '#/definitions/RuleAction',
        },
        active: {
          type: 'boolean',
        },
      },
      required: ['name', 'conditionGroup', 'action', 'active'],
      additionalProperties: false,
      description: 'Rule Types',
    },
    ConditionGroup: {
      type: 'object',
      properties: {
        conditions: {
          type: 'array',
          items: {
            $ref: '#/definitions/RuleCondition',
          },
        },
      },
      required: ['conditions'],
      additionalProperties: false,
    },
    RuleCondition: {
      type: 'object',
      properties: {
        op: {
          $ref: '#/definitions/RuleOperator',
        },
        neg: {
          type: 'boolean',
        },
        type: {
          $ref: '#/definitions/RuleType',
        },
        key: {
          type: 'string',
        },
        value: {
          anyOf: [
            {
              type: 'string',
            },
            {
              type: 'number',
            },
            {
              type: 'array',
              items: {
                type: 'string',
              },
            },
            {
              type: 'array',
              items: {
                type: 'number',
              },
            },
          ],
        },
      },
      required: ['op', 'type'],
      additionalProperties: false,
      description: 'Rule Condition Types',
    },
    RuleOperator: {
      type: 'string',
      enum: ['eq', 'pre', 'suf', 'inc', 'sub', 're', 'ex', 'nex'],
    },
    RuleType: {
      type: 'string',
      enum: [
        'host',
        'path',
        'method',
        'header',
        'query',
        'cookie',
        'target_path',
        'ip_address',
        'region',
        'protocol',
        'scheme',
        'environment',
        'user_agent',
        'geo_continent',
        'geo_country',
        'geo_country_region',
        'geo_city',
        'geo_as_number',
        'ja4_digest',
        'ja3_digest',
        'rate_limit_api_id',
      ],
    },
    RuleAction: {
      type: 'object',
      properties: {
        mitigate: {
          $ref: '#/definitions/MitigationAction',
        },
      },
      required: ['mitigate'],
      additionalProperties: false,
    },
    MitigationAction: {
      type: 'object',
      properties: {
        action: {
          $ref: '#/definitions/ActionType',
        },
        rateLimit: {
          anyOf: [
            {
              $ref: '#/definitions/RateLimit',
            },
            {
              type: 'null',
            },
          ],
        },
        redirect: {
          anyOf: [
            {
              $ref: '#/definitions/Redirect',
            },
            {
              type: 'null',
            },
          ],
        },
        actionDuration: {
          type: ['string', 'null'],
        },
      },
      required: ['action'],
      additionalProperties: false,
    },
    ActionType: {
      type: 'string',
      enum: ['log', 'deny', 'challenge', 'bypass', 'rate_limit', 'redirect'],
      description: 'Core Types',
    },
    RateLimit: {
      type: 'object',
      properties: {
        requests: {
          type: 'number',
        },
        window: {
          type: 'string',
        },
      },
      required: ['requests', 'window'],
      additionalProperties: false,
      description: 'Action Types',
    },
    Redirect: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
        },
        permanent: {
          type: 'boolean',
        },
      },
      required: ['location'],
      additionalProperties: false,
    },
    IPBlockingRule: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
        },
        ip: {
          type: 'string',
        },
        hostname: {
          type: 'string',
        },
        notes: {
          type: 'string',
        },
        action: {
          type: 'string',
          const: 'deny',
        },
      },
      required: ['ip', 'hostname', 'action'],
      additionalProperties: false,
    },
  },
}
