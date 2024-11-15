import type { ErrorObject } from 'ajv'
import Ajv, { Ajv as AjvType } from 'ajv'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { FirewallConfig } from '../types/configTypes'
import { ErrorFormatter } from '../utils/errorFormatter'

export class ValidationError extends Error {
  constructor(
    message: string,
    public errors: ErrorObject[] | null | undefined,
    public customErrors: string[] = [],
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  static formatErrors(schemaErrors: ErrorObject[] | null | undefined, customErrors: string[] = []): string {
    const errors: string[] = []

    if (schemaErrors?.length) {
      errors.push(...schemaErrors.map(ErrorFormatter.formatValidationError))
    }

    if (customErrors.length) {
      errors.push(...customErrors)
    }

    return ErrorFormatter.wrapErrorBlock(errors)
  }

  getFormattedMessage(): string {
    return ValidationError.formatErrors(this.errors, this.customErrors)
  }
}

export class ValidationService {
  private static instance: ValidationService
  private ajv: AjvType
  private schema: object

  private constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
    })

    // Load schema from file
    const schemaPath = resolve(__dirname, '../../../schema/firewall-config.schema.json')
    this.schema = JSON.parse(readFileSync(schemaPath, 'utf8'))
  }

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService()
    }
    return ValidationService.instance
  }

  validateConfig(config: unknown): asserts config is FirewallConfig {
    const validate = this.ajv.compile(this.schema)
    const valid = validate(config)

    if (!valid) {
      throw new ValidationError(
        'Invalid firewall configuration:\n' + ValidationError.formatErrors(validate.errors || []),
        validate.errors,
      )
    }

    // Additional custom validations
    this.validateRuleNames(config as FirewallConfig)
    this.validateRuleValues(config as FirewallConfig)
  }

  private validateRuleNames(config: FirewallConfig): void {
    // Check for duplicate rule names
    const names = new Set<string>()
    for (const rule of config.rules) {
      if (names.has(rule.name)) {
        throw new ValidationError(`Duplicate rule name found: "${rule.name}"`, null)
      }
      names.add(rule.name)
    }
  }

  private validateRuleValues(config: FirewallConfig): void {
    for (const rule of config.rules) {
      // Ensure values array is not empty
      if (!rule.values.length) {
        throw new ValidationError(`Rule "${rule.name}" has no values`, null)
      }

      // Validate values based on rule type
      for (const value of rule.values) {
        switch (rule.type) {
          case 'ip':
            if (!this.isValidIP(value)) {
              throw new ValidationError(`Invalid IP address in rule "${rule.name}": "${value}"`, null)
            }
            break
          case 'asn':
            if (!this.isValidASN(value)) {
              throw new ValidationError(`Invalid ASN in rule "${rule.name}": "${value}"`, null)
            }
            break
          case 'path':
            if (!this.isValidPath(value)) {
              throw new ValidationError(`Invalid path in rule "${rule.name}": "${value}"`, null)
            }
            break
        }
      }
    }
  }

  private isValidIP(value: string): boolean {
    // Basic IP validation including CIDR notation
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}(\/\d{1,3})?$/

    if (!ipv4Regex.test(value) && !ipv6Regex.test(value)) {
      return false
    }

    if (value.includes('/')) {
      const [ip, cidr] = value.split('/')
      const cidrNum = cidr ? parseInt(cidr, 10) : NaN
      if (ip && ipv4Regex.test(ip) && (cidrNum < 0 || cidrNum > 32)) return false
      if (ip && ipv6Regex.test(ip) && (cidrNum < 0 || cidrNum > 128)) return false
    }

    return true
  }

  private isValidASN(value: string): boolean {
    // ASN should be a number between 1 and 4294967295
    const num = parseInt(value, 10)
    return !isNaN(num) && num >= 1 && num <= 4294967295
  }

  private isValidPath(value: string): boolean {
    // Path should start with / and not contain spaces
    return value.startsWith('/') && !value.includes(' ')
  }
}
