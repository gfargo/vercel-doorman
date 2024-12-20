import chalk from 'chalk'
import { ConditionGroup } from '../../types'

/**
 * Formats an array of condition groups into a string representation.
 *
 * Each condition group is formatted with its conditions, and groups are separated by "OR".
 * Conditions within a group are formatted as `type:op:value` with specific color coding.
 *
 * @param {ConditionGroup[]} [groups=[]] - The array of condition groups to format.
 * @returns {string} The formatted string representation of the condition groups.
 */
export function formatConditionGroups(groups: ConditionGroup[] = []): string {
  return groups
    .map((group, groupIndex) => {
      const conditions = group.conditions
        .map((c) => chalk.cyan(`${c.type}:${c.neg ? chalk.red(`!${c.op}:`) : `${c.op}:`}${chalk.white(c.value)}`))
        .join('\n')
      return groupIndex > 0 ? `${chalk.yellow('OR')}\n${conditions}` : conditions
    })
    .join('\n')
}
