import { logger } from '../logger'
import chalk from 'chalk'

export class PerformanceTimer {
  private startTime: number
  private label: string

  constructor(label: string) {
    this.label = label
    this.startTime = Date.now()
  }

  end(): number {
    const duration = Date.now() - this.startTime
    return duration
  }

  endWithLog(): number {
    const duration = this.end()
    logger.debug(`${chalk.dim('⏱️')} ${this.label}: ${chalk.yellow(`${duration}ms`)}`)
    return duration
  }
}

export const measureAsync = async <T>(
  label: string,
  fn: () => Promise<T>,
): Promise<{ result: T; duration: number }> => {
  const timer = new PerformanceTimer(label)
  const result = await fn()
  const duration = timer.endWithLog()
  return { result, duration }
}

export const measure = <T>(label: string, fn: () => T): { result: T; duration: number } => {
  const timer = new PerformanceTimer(label)
  const result = fn()
  const duration = timer.endWithLog()
  return { result, duration }
}
