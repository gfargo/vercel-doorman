import chalk from 'chalk'
import { RuleChangeStatus } from '.'

/**
 * Formats the change status of a rule into a colored symbol string.
 *
 * @param status - The status of the rule change. Can be one of the following:
 *   - 'unchanged': No change in the rule.
 *   - 'modified': The rule has been modified.
 *   - 'new': A new rule has been added.
 *   - 'deleted': The rule has been deleted.
 * @returns A string representing the formatted status with appropriate color and symbol.
 */
export function formatChangeStatus(status: RuleChangeStatus): string {
  switch (status) {
    case 'unchanged':
      return chalk.bold.gray(' ')
    case 'modified':
      return chalk.bold.yellow('▴')
    case 'new':
      return chalk.bold.green('+')
    case 'deleted':
      return chalk.bold.red('-')
  }
}
