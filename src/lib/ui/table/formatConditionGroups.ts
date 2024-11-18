import chalk from 'chalk'
import { VercelConditionGroup } from '../../types/vercelTypes'

export function formatConditionGroups(groups: VercelConditionGroup[] = []): string {
  return groups
    .map((group, groupIndex) => {
      const conditions = group.conditions.map((c) => chalk.cyan(`${c.type}:${c.op}:${chalk.white(c.value)}`)).join('\n')
      return groupIndex > 0 ? `${chalk.yellow('OR')}\n${conditions}` : conditions
    })
    .join('\n')
}
