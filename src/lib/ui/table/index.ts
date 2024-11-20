import chalk from 'chalk'
import Table from 'cli-table3'
import { logger } from '../../logger'
import { FirewallConfig } from '../../types/configTypes'
import { formatAction } from './formatAction'
import { formatConditionGroups } from './formatConditionGroups'

export function displayRulesTable(rules: FirewallConfig['rules']) {
  const table = new Table({
    head: [
      chalk.bold.gray(''),
      chalk.bold.gray('ID'),
      chalk.bold.gray('Name'),
      chalk.bold.gray('Conditions'),
      chalk.bold.gray('Action'),
      chalk.bold.gray('Description'),
    ],
    wordWrap: true,
    colAligns: ['center', 'left', 'left', 'left', 'center', 'left'],
    truncate: '...',
    wrapOnWordBoundary: true,
    colWidths: [3, 32, 24, 24, 8, 36],
  })

  rules.forEach((rule) => {
    table.push([
      rule.active ? chalk.green('✓') : chalk.red('✗'),
      rule.id ? chalk.white(rule.id) : chalk.gray('-'),
      rule.name,
      formatConditionGroups(rule.conditionGroup),
      formatAction(rule.action),
      rule.description || '',
    ])
  })
  logger.log(table.toString())
}
