import { logger } from '../logger'
import { existsSync, writeFileSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { mkdirSync } from 'fs'
import type { UnifiedConfig } from '../types/unified'
import type { FirewallConfig } from '../types'

/**
 * Backup metadata
 */
export interface BackupMetadata {
  timestamp: string
  operation: string
  provider: string
  configPath: string
  backupPath: string
  ruleCount: number
  ipCount: number
}

/**
 * Backup and rollback guidance utilities
 */
export class BackupGuidance {
  private static readonly BACKUP_DIR = '.doorman-backups'

  /**
   * Create a backup of the current configuration
   */
  public static async createBackup(
    config: UnifiedConfig | FirewallConfig,
    operation: string,
    configPath: string,
  ): Promise<BackupMetadata> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const backupDir = join(dirname(configPath), this.BACKUP_DIR)

    // Ensure backup directory exists
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true })
    }

    const backupFileName = `config-backup-${timestamp}.json`
    const backupPath = join(backupDir, backupFileName)

    // Create backup
    try {
      writeFileSync(backupPath, JSON.stringify(config, null, 2))

      const metadata: BackupMetadata = {
        timestamp,
        operation,
        provider: this.getConfigProvider(config),
        configPath,
        backupPath,
        ruleCount: this.getRuleCount(config),
        ipCount: this.getIPCount(config),
      }

      // Save metadata
      const metadataPath = join(backupDir, `${backupFileName}.meta.json`)
      writeFileSync(metadataPath, JSON.stringify(metadata, null, 2))

      logger.info(`📦 Backup created: ${backupPath}`)
      return metadata
    } catch (error) {
      throw new Error(`Failed to create backup: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Show backup recommendations for an operation
   */
  public static showBackupRecommendations(operation: string, riskLevel: 'low' | 'medium' | 'high'): void {
    if (riskLevel === 'low') {
      return // No backup needed for low-risk operations
    }

    logger.info('\n💾 Backup Recommendations:')

    const recommendations = this.getBackupRecommendations(operation, riskLevel)
    recommendations.forEach((rec) => {
      logger.info(`   • ${rec}`)
    })

    if (riskLevel === 'high') {
      logger.warn('\n⚠️  High-risk operation detected!')
      logger.warn('   Consider testing in a staging environment first')
      logger.warn('   Ensure you have a rollback plan ready')
    }
  }

  /**
   * Show rollback guidance after a failed operation
   */
  public static showRollbackGuidance(operation: string, backupMetadata?: BackupMetadata): void {
    logger.info('\n🔄 Rollback Guidance:')

    if (backupMetadata) {
      logger.info('   To restore from backup:')
      logger.info(`   1. Copy backup file: ${backupMetadata.backupPath}`)
      logger.info(`   2. Replace current config: ${backupMetadata.configPath}`)
      logger.info(`   3. Run sync command to restore remote state`)
      logger.info('')
      logger.info(`   Quick restore command:`)
      logger.info(`   cp "${backupMetadata.backupPath}" "${backupMetadata.configPath}"`)
      logger.info(`   doorman sync --config "${backupMetadata.configPath}"`)
    } else {
      const guidance = this.getRollbackGuidance(operation)
      guidance.forEach((step) => {
        logger.info(`   • ${step}`)
      })
    }
  }

  /**
   * List available backups
   */
  public static listBackups(configPath: string): BackupMetadata[] {
    const backupDir = join(dirname(configPath), this.BACKUP_DIR)

    if (!existsSync(backupDir)) {
      return []
    }

    const fs = require('fs')
    const files = fs.readdirSync(backupDir)
    const metadataFiles = files.filter((file: string) => file.endsWith('.meta.json'))

    const backups: BackupMetadata[] = []

    for (const metaFile of metadataFiles) {
      try {
        const metaPath = join(backupDir, metaFile)
        const metadata = JSON.parse(readFileSync(metaPath, 'utf8')) as BackupMetadata

        // Verify backup file still exists
        if (existsSync(metadata.backupPath)) {
          backups.push(metadata)
        }
      } catch (error) {
        logger.debug(`Failed to read backup metadata ${metaFile}: ${error}`)
      }
    }

    return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }

  /**
   * Clean up old backups (keep last 10)
   */
  public static cleanupOldBackups(configPath: string, keepCount: number = 10): void {
    const backups = this.listBackups(configPath)

    if (backups.length <= keepCount) {
      return
    }

    const toDelete = backups.slice(keepCount)
    const fs = require('fs')

    for (const backup of toDelete) {
      try {
        // Delete backup file
        if (existsSync(backup.backupPath)) {
          fs.unlinkSync(backup.backupPath)
        }

        // Delete metadata file
        const metaPath = `${backup.backupPath}.meta.json`
        if (existsSync(metaPath)) {
          fs.unlinkSync(metaPath)
        }

        logger.debug(`Cleaned up old backup: ${backup.backupPath}`)
      } catch (error) {
        logger.debug(`Failed to cleanup backup ${backup.backupPath}: ${error}`)
      }
    }

    if (toDelete.length > 0) {
      logger.debug(`Cleaned up ${toDelete.length} old backups`)
    }
  }

  /**
   * Get backup recommendations for operation
   */
  private static getBackupRecommendations(operation: string, riskLevel: 'low' | 'medium' | 'high'): string[] {
    const baseRecommendations = [
      'A backup will be created automatically before making changes',
      'Keep your configuration files in version control',
    ]

    const operationRecommendations: Record<string, string[]> = {
      'sync rules': [
        'Download current remote configuration as additional backup',
        'Test configuration in staging environment if available',
      ],
      'clear all rules': [
        'Export complete current configuration',
        'Document business justification for clearing rules',
        'Prepare replacement rules before clearing',
      ],
      'delete ruleset': [
        'Export ruleset configuration before deletion',
        'Verify no other systems depend on this ruleset',
      ],
    }

    const riskRecommendations: Record<string, string[]> = {
      high: [
        'Create manual backup in addition to automatic backup',
        'Notify team members about the planned changes',
        'Schedule change during low-traffic period',
        'Have rollback plan documented and ready',
      ],
      medium: ['Review changes carefully before applying', 'Monitor application after changes'],
      low: [],
    }

    return [
      ...baseRecommendations,
      ...(operationRecommendations[operation] || []),
      ...(riskRecommendations[riskLevel] || []),
    ]
  }

  /**
   * Get rollback guidance for operation
   */
  private static getRollbackGuidance(operation: string): string[] {
    const baseGuidance = [
      'Restore configuration from backup file',
      'Run sync command to apply restored configuration',
      'Verify all rules are working correctly',
    ]

    const operationGuidance: Record<string, string[]> = {
      'sync rules': [
        'Use backup configuration file to restore previous state',
        'Check rule functionality after restoration',
      ],
      'clear all rules': [
        'Restore from backup immediately to restore protection',
        'Verify all security rules are active',
      ],
      'delete ruleset': [
        'Recreate ruleset from backup configuration',
        'May require manual recreation if backup is unavailable',
      ],
    }

    return [...baseGuidance, ...(operationGuidance[operation] || [])]
  }

  /**
   * Get provider from config
   */
  private static getConfigProvider(config: UnifiedConfig | FirewallConfig): string {
    if ('provider' in config && config.provider) {
      return config.provider
    }
    if ('projectId' in config && config.projectId) {
      return 'vercel'
    }
    return 'unknown'
  }

  /**
   * Get rule count from config
   */
  private static getRuleCount(config: UnifiedConfig | FirewallConfig): number {
    return config.rules?.length || 0
  }

  /**
   * Get IP count from config
   */
  private static getIPCount(config: UnifiedConfig | FirewallConfig): number {
    return config.ips?.length || 0
  }
}
