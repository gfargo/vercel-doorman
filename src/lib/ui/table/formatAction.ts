import chalk from 'chalk'
import { VercelAction } from 'src/lib/types/vercelTypes'
import { RuleAction, RuleActionType } from '../../types/configTypes'

/**
 * Formats a `RuleAction` or `RuleActionType` into a string representation.
 *
 * @param action - The action to format. It can be either a `RuleAction` object or a `RuleActionType` string.
 * @returns A formatted string representation of the action.
 *
 * The formatted string includes:
 * - The action type in cyan color.
 * - The rate limit in yellow color, if present.
 * - The redirect location in magenta color, with an indication of whether it is permanent or temporary in gray color, if present.
 * - The duration in gray color, if present.
 */
export function formatAction(action: RuleAction | RuleActionType | VercelAction): string {
  if (typeof action === 'string') {
    return action
  }

  if ('mitigate' in action) {
    return chalk.cyan((action as VercelAction).mitigate.action)
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
