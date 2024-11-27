import chalk from 'chalk'
import { IPBlockingRule } from '../../types/configTypes'

export function formatIPBlockingRule(rule: IPBlockingRule & { changeStatus?: string }) {
  return {
    id: rule.id || '-',
    ip: rule.ip,
    hostname: rule.hostname,
    notes: rule.notes || '-',
    status: rule.changeStatus ? chalk.yellow(rule.changeStatus) : chalk.red('deny'),
  }
}
