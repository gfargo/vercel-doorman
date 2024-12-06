import chalk from 'chalk'
import { RuleAction } from '../../types'

const formatDuration = (duration: string): string => {
  if (duration === 'permanent') return 'permanent'

  // Convert "24h", "30m", etc. to more readable format
  const value = duration.slice(0, -1)
  const unit = duration.slice(-1)
  const units: Record<string, string> = {
    s: 'sec',
    m: 'min',
    h: 'hr',
    d: 'day',
  }
  return `${value}${units[unit] || unit}`
}

const formatRateLimit = (requests: number, window: string): string => {
  // Convert window to readable format (e.g., "60s" to "min")
  if (window === '60s') return `${requests}/min`
  if (window === '3600s') return `${requests}/hr`
  if (window === '86400s') return `${requests}/day`
  return `${requests}/${formatDuration(window)}`
}

/**
 * Formats a `VercelAction` into a clear string representation.
 *
 * Examples:
 * - Rate limit: "rate-limit 100/min"
 * - Redirect: "redirect → /path (301)"
 * - Block with duration: "deny for 24hr"
 * - Challenge: "challenge"
 */
export function formatAction(action: RuleAction): string {
  if (!action.mitigate) {
    return 'unknown'
  }

  const { mitigate } = action
  const parts: string[] = []

  // Add base action type
  switch (mitigate.action) {
    case 'log':
      parts.push(chalk.blue('log'))
      break
    case 'deny':
      parts.push(chalk.red('deny'))
      break
    case 'challenge':
      parts.push(chalk.yellow('challenge'))
      break
    case 'bypass':
      parts.push(chalk.green('bypass'))
      break
    case 'rate_limit':
      parts.push(chalk.yellow('rate-limit'))
      break
    case 'redirect':
      parts.push(chalk.magenta('redirect'))
      break
    default:
      parts.push(mitigate.action)
  }

  // Add rate limit info
  if (mitigate.rateLimit) {
    parts[0] = chalk.yellow('rate-limit') // Override action type
    parts.push(chalk.yellow(formatRateLimit(mitigate.rateLimit.requests, mitigate.rateLimit.window)))
  }

  // Add redirect info
  if (mitigate.redirect) {
    parts[0] = chalk.magenta('redirect') // Override action type
    parts.push(chalk.magenta(`→ ${mitigate.redirect.location}`))
    if (mitigate.redirect.permanent !== undefined) {
      parts.push(chalk.gray(`(${mitigate.redirect.permanent ? '301' : '302'})`))
    }
  }

  // Add duration
  if (mitigate.actionDuration) {
    parts.push(chalk.gray(`for ${formatDuration(mitigate.actionDuration)}`))
  }

  return parts.join(' ')
}
