import type { ErrorObject } from 'ajv'
import Ajv, { Ajv as AjvType } from 'ajv'
import { z } from 'zod'
import { schema } from '../../constants/schema'
import { firewallConfigSchema } from '../schemas/firewallSchemas'
import { FirewallConfig } from '../types/configTypes'
import { ErrorFormatter } from '../utils/errorFormatter'

export class ValidationError extends Error {
  constructor(
    message: string,
    public ajvErrors: ErrorObject[] | null | undefined,
    public zodError?: z.ZodError,
    public customErrors: string[] = [],
  ) {
    super(message)
    this.name = 'ValidationError'
  }

  static formatErrors(
    ajvErrors: ErrorObject[] | null | undefined,
    zodError?: z.ZodError,
    customErrors: string[] = [],
  ): string {
    const errors: string[] = []

    if (ajvErrors?.length) {
      errors.push(...ajvErrors.map(ErrorFormatter.formatValidationError))
    }

    if (zodError) {
      errors.push(
        ...zodError.errors.map((err) => {
          const path = err.path.join('.')
          return `${path}: ${err.message}`
        }),
      )
    }

    if (customErrors.length) {
      errors.push(...customErrors)
    }

    return ErrorFormatter.wrapErrorBlock(errors)
  }

  getFormattedMessage(): string {
    return ValidationError.formatErrors(this.ajvErrors, this.zodError, this.customErrors)
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

    this.schema = schema
  }

  static getInstance(): ValidationService {
    if (!ValidationService.instance) {
      ValidationService.instance = new ValidationService()
    }
    return ValidationService.instance
  }

  validateConfig(config: unknown): asserts config is FirewallConfig {
    // AJV Validation
    const validate = this.ajv.compile(this.schema)
    const ajvValid = validate(config)
    const ajvErrors = validate.errors

    // Zod Validation
    const zodResult = firewallConfigSchema.safeParse(config)
    let zodError: z.ZodError | undefined

    if (!zodResult.success) {
      zodError = zodResult.error
    }

    // Additional custom validations (only if basic validations pass)
    const customErrors: string[] = []
    if (ajvValid && zodResult.success) {
      try {
        this.validateRuleNames(config as FirewallConfig)
        this.validateRuleStructure(config as FirewallConfig)
        this.validateRuleValues(config as FirewallConfig)
      } catch (error) {
        if (error instanceof ValidationError) {
          customErrors.push(...(error.customErrors || []))
        } else {
          throw error
        }
      }
    }

    // If any validation failed, throw error with all collected errors
    if (!ajvValid || !zodResult.success || customErrors.length > 0) {
      throw new ValidationError(
        'Invalid firewall configuration:\n' + ValidationError.formatErrors(ajvErrors, zodError, customErrors),
        ajvErrors,
        zodError,
        customErrors,
      )
    }
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

  private validateRuleStructure(config: FirewallConfig): void {
    for (const rule of config.rules) {
      if (!rule.conditionGroup && (!rule.type || !rule.values)) {
        throw new ValidationError(
          `Rule "${rule.name}" is missing required fields. Either conditionGroup or type+values must be provided`,
          null,
        )
      }
      if (rule.conditionGroup && (rule.type || rule.values)) {
        throw new ValidationError(
          `Rule "${rule.name}" has conflicting fields. Use either conditionGroup or type+values, not both`,
          null,
        )
      }
    }
  }

  private validateRuleValues(config: FirewallConfig): void {
    for (const rule of config.rules) {
      if (rule.type && rule.values) {
        // Validate values based on rule type
        for (const value of rule.values) {
          switch (rule.type) {
            case 'ip_address':
              if (!this.isValidIP(value)) {
                throw new ValidationError(`Invalid IP address in rule "${rule.name}": "${value}"`, null)
              }
              break
            case 'geo_as_number':
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
      } else if (rule.conditionGroup) {
        // Validate conditionGroup structure
        for (const group of rule.conditionGroup) {
          if (!group.conditions || group.conditions.length === 0) {
            throw new ValidationError(`Rule "${rule.name}" has an empty condition group`, null)
          }
          for (const condition of group.conditions) {
            if (!condition.type || !condition.op || !condition.value) {
              throw new ValidationError(`Rule "${rule.name}" has an invalid condition`, null)
            }
          }
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
