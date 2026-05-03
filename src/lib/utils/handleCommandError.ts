import chalk from 'chalk'
import { ZodError } from 'zod'
import { logger } from '../logger'
import { ErrorFormatter } from './errorFormatter'

/**
 * Centralized error handler for CLI commands.
 * Provides consistent error formatting across all commands.
 *
 * @param error - The caught error
 * @param context - A short description of what was happening (e.g., 'syncing firewall rules')
 */
export function handleCommandError(error: unknown, context: string): never {
  if (error instanceof SyntaxError) {
    logger.log(ErrorFormatter.wrapErrorBlock(['Invalid JSON format in config file:', `  ${error.message}`]))
  } else if (error instanceof ZodError) {
    logger.error(chalk.red('Schema validation failed:'))
    error.errors.forEach((err) => {
      const path = err.path.join('.')
      logger.error(chalk.red(`  - ${path}: ${err.message}`))
    })
  } else if (error instanceof Error && error.name === 'ValidationError') {
    logger.error(error)
  } else if (error instanceof Error && error.message.includes('Forbidden')) {
    logger.log(
      ErrorFormatter.wrapErrorBlock([
        `Error ${context}:`,
        '  Access denied. Check that your token has the correct scope.',
        '  If using a team, ensure the token is scoped to that team.',
      ]),
    )
  } else {
    logger.error(
      ErrorFormatter.wrapErrorBlock([
        `Error ${context}:`,
        `  ${error instanceof Error ? error.message : String(error)}`,
      ]),
    )
  }
  process.exit(1)
}
