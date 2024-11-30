import chalk from 'chalk'
import { RuleChangeStatus } from '.'

/**
 * Returns a function that applies a color to a given text based on the provided status.
 *
 * @param {RuleChangeStatus} [status] - The status of the rule change which determines the color.
 * @returns {(text: string) => string} - A function that takes a string and returns the colored string.
 *
 * @example
 * const colorize = getRowColor('new');
 * console.log(colorize('This is a new rule')); // Outputs green colored text
 *
 * @remarks
 * The possible statuses and their corresponding colors are:
 * - 'unchanged': white
 * - 'modified': yellow
 * - 'new': green
 * - 'deleted': red
 */
export function getRowColor(status?: RuleChangeStatus): (text: string) => string {
  switch (status) {
    default:
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
