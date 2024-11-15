import { ErrorObject } from 'ajv'
import chalk from 'chalk'

export class ErrorFormatter {
  static formatValidationError(error: ErrorObject): string {
    const path = error.instancePath || '/'
    const formattedPath = chalk.cyan(path)

    switch (error.keyword) {
      case 'type':
        return `${formattedPath}: Expected ${chalk.green(error.schema)}, got ${chalk.red(typeof error.data)}`

      case 'enum': {
        const allowedValues = (error.params as { allowedValues: string[] }).allowedValues
        return `${formattedPath}: Value must be one of: ${chalk.green(allowedValues.join(', '))}`
      }
      case 'required': {
        const params = error.params as { missingProperty: string }
        return `${formattedPath}: Missing required property ${chalk.yellow(params.missingProperty)}`
      }
      case 'additionalProperties': {
        const additionalParams = error.params as { additionalProperty: string }
        return `${formattedPath}: Unknown property ${chalk.red(additionalParams.additionalProperty)}`
      }

      default:
        return `${formattedPath}: ${error.message}`
    }
  }

  static formatCustomError(ruleName: string, message: string): string {
    return `${chalk.cyan(ruleName)}: ${message}`
  }

  static wrapErrorBlock(errors: string[]): string {
    const header = chalk.red.bold('Validation Errors:')
    const formattedErrors = errors.map((err) => `  ${err}`).join('\n')
    return `${header}\n${formattedErrors}`
  }

  static formatSuccessMessage(message: string): string {
    return chalk.green(`✓ ${message}`)
  }

  static formatDetailedRuleValidation(ruleName: string, checks: { name: string; passed: boolean }[]): string {
    const header = chalk.cyan(`Rule: ${ruleName}`)
    const details = checks
      .map((check) => {
        const icon = check.passed ? chalk.green('✓') : chalk.red('✗')
        const name = check.passed ? chalk.green(check.name) : chalk.red(check.name)
        return `  ${icon} ${name}`
      })
      .join('\n')
    return `${header}\n${details}`
  }
}
