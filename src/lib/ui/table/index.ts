import chalk from 'chalk'
import Table, { HorizontalAlignment } from 'cli-table3'
import { logger } from '../../logger'
import { FirewallConfig } from '../../types/configTypes'
import { formatAction } from './formatAction'
import { formatChangeStatus } from './formatChangeStatus'
import { formatConditionGroups } from './formatConditionGroups'
import { getRowColor } from './getRowColor'

export type RuleChangeStatus = 'unchanged' | 'modified' | 'new' | 'deleted'

export const RULE_STATUS_MAP = {
  unchanged: 'unchanged' as RuleChangeStatus,
  modified: 'modified' as RuleChangeStatus,
  new: 'new' as RuleChangeStatus,
  deleted: 'deleted' as RuleChangeStatus,
}

export type Rule = FirewallConfig['rules'][number]
interface RuleWithChangeStatus extends Rule {
  changeStatus: RuleChangeStatus
}

export function displayRulesTable(
  rules: RuleWithChangeStatus[] | Rule[],
  { showStatus }: { showStatus: boolean },
): void {
  const tableHead = [
    chalk.bold.gray('ID'),
    chalk.bold.gray('Name'),
    chalk.bold.gray('Conditions'),
    chalk.bold.gray(' '), // Active
    chalk.bold.gray('Action'),
    chalk.bold.gray('Description'),
  ]
  const tableColAligns = ['left', 'left', 'left', 'center', 'center', 'left'] as HorizontalAlignment[]

  if (showStatus) {
    tableHead.unshift(chalk.bold.gray('Status'))
    tableColAligns.unshift('center')
  }

  const table = new Table({
    head: tableHead,
    colAligns: tableColAligns,
    wrapOnWordBoundary: true,
    wordWrap: true,
    truncate: '...',
  })

  rules.forEach((rule) => {
    const hasStatus = 'changeStatus' in rule && showStatus
    const rowColor = hasStatus ? getRowColor((rule as RuleWithChangeStatus).changeStatus) : chalk.white

    const rowColumns = [
      rowColor(rule.id ? rule.id : '-'),
      rowColor(rule.name),
      rowColor(formatConditionGroups(rule.conditionGroup)),
      rule.active ? chalk.bold.green('✓') : chalk.bold.red('✗'),
      rowColor(formatAction(rule.action)),
      rowColor(rule.description || ''),
    ]

    if (hasStatus) {
      rowColumns.unshift(rowColor(formatChangeStatus((rule as RuleWithChangeStatus).changeStatus)))
    }

    table.push(rowColumns)
  })

  logger.log(table.toString())
}
