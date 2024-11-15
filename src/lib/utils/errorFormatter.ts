import chalk from 'chalk'
import { ErrorObject } from 'ajv'

export class ErrorFormatter {
  static formatValidationError(error: ErrorObject): string {
    const path = error.instancePath || '/'
    const formattedPath = chalk.cyan(path)

    switch (error.keyword) {
      case 'type':
        return `${formattedPath}: Expected ${chalk.green(error.params.type)}, got ${chalk.red(typeof error.data)}`

      case 'enum':
        return `${formattedPath}: Value must be one of: ${chalk.green(error.params.allowedValues.join(', '))}`

      case 'required':
        return `${formattedPath}: Missing required property ${chalk.yellow(error.params.missingProperty)}`

      case 'additionalProperties':
        return `${formattedPath}: Unknown property ${chalk.red(error.params.additionalProperty)}`

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
