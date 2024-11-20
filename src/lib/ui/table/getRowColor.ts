import chalk from 'chalk'
import { RuleChangeStatus } from '.'

export function getRowColor(status: RuleChangeStatus): (text: string) => string {
  switch (status) {
    case 'unchanged':
      return chalk.white
    case 'modified':
      return chalk.yellow
    case 'new':
      return chalk.green
    case 'deleted':
      return chalk.red
  }
}
