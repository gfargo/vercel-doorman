import chalk from 'chalk'
import Table from 'cli-table3'
import { logger } from 'src/lib/logger'
import { FirewallConfig } from '../../types/configTypes'
import { formatAction } from './formatAction'
import { formatConditionGroups } from './formatConditionGroups'

export function displayRulesTable(rules: FirewallConfig['rules']) {
  const table = new Table({
    head: [
      chalk.bold(''),
      chalk.bold('ID'),
      chalk.bold('Name'),
      chalk.bold('Conditions'),
      chalk.bold('Action'),
      chalk.bold('Description'),
    ],
    wordWrap: true,
    truncate: '...',
    wrapOnWordBoundary: true,
    colWidths: [3, 32, 24, 24, 8, 36],
  })

  rules.forEach((rule) => {
    table.push([
      rule.active ? chalk.green('✓') : chalk.red('✗'),
      rule.id ? chalk.gray(rule.id) : chalk.gray('-'),
      rule.name,
      formatConditionGroups(rule.conditionGroup),
      formatAction(rule.action),
      rule.description || '',
    ])
  })

  logger.log(chalk.bold('\nRemote Firewall Rules to Download:\n'))
  logger.log(table.toString())
}
