import chalk from 'chalk'
import Table, { HorizontalAlignment } from 'cli-table3'
import { logger } from '../../logger'
import { FirewallConfig } from '../../types/configTypes'
import { calculateDynamicColWidths } from './calculateDynamicColWidths'
import { formatAction } from './formatAction'
import { formatChangeStatus } from './formatChangeStatus'
import { formatConditionGroups } from './formatConditionGroups'
import { formatIPBlockingRule } from './formatIPBlockingRule'
import { getRowColor } from './getRowColor'

export type RuleChangeStatus = 'unchanged' | 'modified' | 'new' | 'deleted'

export const RULE_STATUS_MAP = {
  unchanged: 'unchanged' as RuleChangeStatus,
  modified: 'modified' as RuleChangeStatus,
  new: 'new' as RuleChangeStatus,
  deleted: 'deleted' as RuleChangeStatus,
}

interface ColumnConfig {
  minWidths: number[]
  maxWidths: (number | null)[]
  flexColumns: number[]
}

/**
 * Configuration for table column widths
 */
const RuleTableConfig: ColumnConfig = {
  // Minimum widths for each column [id, name, description, status, time, details]
  minWidths: [10, 28, 24, 5, 8, 35],
  // Maximum widths (null means unlimited)
  maxWidths: [15, 36, 26, 8, 12, null],
  // Specify which columns can flex (0-based indices)
  flexColumns: [0, 1, 2, 5],
}

const IPTableConfig: ColumnConfig = {
  // Minimum widths for each column [id, name, description, status, time, details]
  minWidths: [10, 28, 24, 5, 12],
  // Maximum widths (null means unlimited)
  maxWidths: [20, 32, 26, null, 16],
  // Specify which columns can flex (0-based indices)
  flexColumns: [0, 1, 3],
}

/**
 * Gets calculated table column widths based on terminal width
 * @param variant - Table variant ('rules' or 'ip')
 * @param terminalWidth - Current terminal width in characters
 * @returns Array of calculated column widths
 */
const getTableColWidths = (variant: 'rules' | 'ip', terminalWidth: number | undefined): number[] => {
  if (variant === 'ip') {
    return calculateDynamicColWidths(
      terminalWidth,
      IPTableConfig.minWidths,
      IPTableConfig.maxWidths,
      IPTableConfig.flexColumns,
    )
  }

  // Default to rules table config
  return calculateDynamicColWidths(
    terminalWidth,
    RuleTableConfig.minWidths,
    RuleTableConfig.maxWidths,
    RuleTableConfig.flexColumns,
  )
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

  const currentTerminalWidth = process.stdout.columns || 400
  const colWidths = getTableColWidths('rules', currentTerminalWidth)

  if (showStatus) {
    tableHead.unshift(chalk.bold.gray('Status'))
    tableColAligns.unshift('center')
    colWidths.unshift(10)
  }

  const table = new Table({
    head: tableHead,
    colAligns: tableColAligns,
    wrapOnWordBoundary: true,
    wordWrap: true,
    colWidths: colWidths,
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

export type IPBlockingRuleWithStatus = NonNullable<FirewallConfig['ips']>[number] & { changeStatus?: RuleChangeStatus }

export function displayIPBlockingTable(
  rules: IPBlockingRuleWithStatus[],
  { showStatus }: { showStatus: boolean },
): void {
  const tableHead = [
    chalk.bold.gray('ID'),
    chalk.bold.gray('IP'),
    chalk.bold.gray('Hostname'),
    chalk.bold.gray('Notes'),
    chalk.bold.gray('Action'),
  ]
  const tableColAligns = ['left', 'left', 'left', 'left', 'center'] as HorizontalAlignment[]

  const currentTerminalWidth = process.stdout.columns || 400
  const colWidths = getTableColWidths('ip', currentTerminalWidth)

  if (showStatus) {
    tableHead.unshift(chalk.bold.gray('Status'))
    tableColAligns.unshift('center')
    colWidths.unshift(10)
  }
  const table = new Table({
    head: tableHead,
    colAligns: tableColAligns,
    wrapOnWordBoundary: true,
    wordWrap: true,
    colWidths,
  })

  rules.forEach((rule) => {
    const hasStatus = rule.changeStatus !== undefined && showStatus
    const rowColor = hasStatus ? getRowColor(rule.changeStatus) : chalk.white
    const formattedRule = formatIPBlockingRule(rule)

    const rowColumns = [
      rowColor(formattedRule.id),
      rowColor(formattedRule.ip),
      rowColor(formattedRule.hostname),
      rowColor(formattedRule.notes),
      formattedRule.status,
    ]

    if (hasStatus) {
      rowColumns.unshift(rowColor(formatChangeStatus(rule.changeStatus!)))
    }

    table.push(rowColumns)
  })

  logger.log(table.toString())
}
