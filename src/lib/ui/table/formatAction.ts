import chalk from 'chalk'
import { RuleAction, RuleActionType } from '../../types/configTypes'

export const formatAction = (action: RuleAction | RuleActionType): string => {
  if (typeof action === 'string') {
    return action
  }

  const parts = [chalk.cyan(action.type)]

  if (action.rateLimit) {
    parts.push(chalk.yellow(`${action.rateLimit.requests}/${action.rateLimit.window}`))
  }
  if (action.redirect) {
    parts.push(chalk.magenta(`→ ${action.redirect.location}`))
    if (action.redirect.permanent) {
      parts[parts.length - 1] += chalk.gray(` (${action.redirect.permanent ? 'permanent' : 'temporary'})`)
    }
  }
  if (action.duration) {
    parts.push(chalk.gray(`for ${action.duration}`))
  }

  return parts.join('\n')
}
