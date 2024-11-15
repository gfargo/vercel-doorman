export const schema = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "Vercel Doorman Firewall Configuration",
  "description": "Schema for vercel-doorman firewall configuration files",
  "$ref": "#/definitions/FirewallConfig",
  "definitions": {
    "FirewallConfig": {
      "type": "object",
      "properties": {
        "projectId": {
          "type": "string"
        },
        "teamId": {
          "type": "string"
        },
        "rules": {
          "type": "array",
          "items": {
            "$ref": "#/definitions/ConfigRule"
          }
        }
      },
      "required": [
        "rules"
      ],
      "additionalProperties": false
    },
    "ConfigRule": {
      "type": "object",
      "properties": {
        "name": {
          "type": "string"
        },
        "description": {
          "type": "string"
        },
        "type": {
          "$ref": "#/definitions/RuleType"
        },
        "values": {
          "type": "array",
          "items": {
            "type": "string"
          }
        },
        "action": {
          "$ref": "#/definitions/RuleAction"
        },
        "active": {
          "type": "boolean"
        }
      },
      "required": [
        "name",
        "type",
        "values",
        "action",
        "active"
      ],
      "additionalProperties": false
    },
    "RuleType": {
      "type": "string",
      "enum": [
        "ip",
        "asn",
        "path",
        "cookie"
      ]
    },
    "RuleAction": {
      "type": "string",
      "enum": [
        "allow",
        "deny",
        "challenge"
      ]
    }
  }
}