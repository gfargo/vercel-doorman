import chalk from 'chalk'
import { RuleChangeStatus } from '.'

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
