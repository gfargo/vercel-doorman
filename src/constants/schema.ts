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
        version: {
          type: 'number',
        },
        updatedAt: {
          type: 'string',
        },
      },
      required: ['rules'],
      additionalProperties: false,
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
        type: {
          $ref: '#/definitions/RuleType',
        },
        values: {
          type: 'array',
          items: {
            type: 'string',
          },
        },
        conditionGroup: {
          type: 'array',
          items: {
            $ref: '#/definitions/VercelConditionGroup',
          },
        },
        action: {
          anyOf: [
            {
              $ref: '#/definitions/RuleAction',
            },
            {
              $ref: '#/definitions/RuleActionType',
            },
          ],
        },
        active: {
          type: 'boolean',
        },
      },
      required: ['name', 'action', 'active'],
      additionalProperties: false,
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
    VercelConditionGroup: {
      type: 'object',
      properties: {
        conditions: {
          type: 'array',
          items: {
            $ref: '#/definitions/VercelCondition',
          },
        },
      },
      required: ['conditions'],
      additionalProperties: false,
    },
    VercelCondition: {
      type: 'object',
      properties: {
        op: {
          $ref: '#/definitions/RuleOperator',
        },
        type: {
          $ref: '#/definitions/RuleType',
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
      required: ['op', 'type', 'value'],
      additionalProperties: false,
    },
    RuleOperator: {
      type: 'string',
      enum: ['re', 'eq', 'neq', 'ex', 'nex', 'inc', 'ninc', 'pre', 'suf', 'sub', 'gt', 'gte', 'lt', 'lte'],
    },
    RuleAction: {
      type: 'object',
      properties: {
        type: {
          $ref: '#/definitions/RuleActionType',
        },
        rateLimit: {
          $ref: '#/definitions/RuleRateLimit',
        },
        redirect: {
          $ref: '#/definitions/RuleRedirect',
        },
        duration: {
          type: 'string',
        },
      },
      required: ['type'],
      additionalProperties: false,
    },
    RuleActionType: {
      type: 'string',
      enum: ['allow', 'deny', 'challenge', 'log'],
    },
    RuleRateLimit: {
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
    },
    RuleRedirect: {
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
