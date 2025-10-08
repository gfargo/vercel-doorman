import chalk from 'chalk'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'

interface SetupOptions {
  // No options needed for this command
}

export const command = 'setup'
export const desc = 'Show setup instructions and helpful links for Vercel Doorman'

export const builder = {}

export const handler = async (argv: Arguments<SetupOptions>) => {
  logger.log('')
  logger.log(chalk.bold.cyan('🚪 Vercel Doorman Setup Guide'))
  logger.log(chalk.dim('Multi-provider firewall management for Vercel and Cloudflare\n'))

  // Prerequisites
  logger.log(chalk.bold('📋 Prerequisites'))
  logger.log('')
  logger.log(chalk.bold('Vercel:'))
  logger.log('• Vercel account with a deployed project')
  logger.log('• Project with Pro plan or higher')
  logger.log('• Admin access to the project/team')
  logger.log('')
  logger.log(chalk.bold('Cloudflare:'))
  logger.log('• Cloudflare account with an active zone')
  logger.log('• Zone with WAF/Firewall features enabled')
  logger.log('• Admin access to the account')
  logger.log('')

  // Getting IDs
  logger.log(chalk.bold('🔍 Finding Your Provider Information'))
  logger.log('')

  logger.log(chalk.bold.cyan('Vercel:'))
  logger.log('')
  logger.log(chalk.cyan('1. Project ID:'))
  logger.log('   • Go to https://vercel.com/dashboard')
  logger.log('   • Select your project → Settings → General')
  logger.log('   • Copy the Project ID')
  logger.log('')
  logger.log(chalk.cyan('2. Team ID (optional):'))
  logger.log('   • Go to https://vercel.com/dashboard')
  logger.log('   • Click on your team name')
  logger.log('   • Go to Team Settings → General')
  logger.log('   • Copy the Team ID')
  logger.log('')

  logger.log(chalk.bold.cyan('Cloudflare:'))
  logger.log('')
  logger.log(chalk.cyan('1. Zone ID:'))
  logger.log('   • Go to https://dash.cloudflare.com')
  logger.log('   • Select your domain')
  logger.log('   • Find Zone ID in the right sidebar (Overview section)')
  logger.log('')
  logger.log(chalk.cyan('2. Account ID (optional):'))
  logger.log('   • Same location as Zone ID')
  logger.log('   • Or visit https://dash.cloudflare.com/profile')
  logger.log('')

  // API Tokens
  logger.log(chalk.bold('🔑 Creating API Tokens'))
  logger.log('')

  logger.log(chalk.bold.cyan('Vercel:'))
  logger.log('   1. Visit https://vercel.com/account/tokens')
  logger.log('   2. Click "Create Token"')
  logger.log('   3. Name: "Doorman Firewall Management"')
  logger.log('   4. Scope: Select your project or team')
  logger.log('   5. Permissions: Read & Write')
  logger.log('   6. Copy the token')
  logger.log('')

  logger.log(chalk.bold.cyan('Cloudflare:'))
  logger.log('   1. Visit https://dash.cloudflare.com/profile/api-tokens')
  logger.log('   2. Click "Create Token"')
  logger.log('   3. Use template: "Edit zone DNS" + "Account Firewall"')
  logger.log('   4. Select your zone and account')
  logger.log('   5. Copy the token')
  logger.log('')

  // Environment Setup
  logger.log(chalk.bold('🌍 Environment Setup'))
  logger.log('')
  logger.log(chalk.cyan('Vercel:'))
  logger.log(chalk.green('export VERCEL_TOKEN="your-vercel-token"'))
  logger.log('')
  logger.log(chalk.cyan('Cloudflare:'))
  logger.log(chalk.green('export CLOUDFLARE_API_TOKEN="your-cloudflare-token"'))
  logger.log('')
  logger.log(chalk.dim('Add to ~/.bashrc, ~/.zshrc, or .env file for persistence'))
  logger.log('')

  // Quick Start
  logger.log(chalk.bold('🚀 Quick Start Commands'))
  logger.log('')
  logger.log(chalk.cyan('1. Initialize configuration:'))
  logger.log('   vercel-doorman init --interactive')
  logger.log(chalk.dim('   (You will be prompted to select provider)'))
  logger.log('')
  logger.log(chalk.cyan('2. Validate setup:'))
  logger.log('   vercel-doorman validate')
  logger.log('')
  logger.log(chalk.cyan('3. Check current status:'))
  logger.log('   vercel-doorman status')
  logger.log('')
  logger.log(chalk.cyan('4. View existing rules:'))
  logger.log('   vercel-doorman list')
  logger.log('')
  logger.log(chalk.cyan('5. Sync your configuration:'))
  logger.log('   vercel-doorman sync')
  logger.log('')

  // Troubleshooting
  logger.log(chalk.bold('🔧 Common Issues'))
  logger.log('')
  logger.log(chalk.yellow('❌ "Project/Zone not found":'))
  logger.log('   • Double-check your IDs')
  logger.log('   • Ensure token has access to the resource')
  logger.log('   • Verify account has required features enabled')
  logger.log('')
  logger.log(chalk.yellow('❌ "Unauthorized" error:'))
  logger.log('   • Check environment variable is set correctly')
  logger.log("   • Ensure token hasn't expired")
  logger.log('   • Verify token has required permissions')
  logger.log('')
  logger.log(chalk.yellow('❌ Provider auto-detection issues:'))
  logger.log('   • Add "provider": "vercel" or "cloudflare" to config')
  logger.log('   • Or use --provider flag in commands')
  logger.log('')

  // Resources
  logger.log(chalk.bold('📚 Additional Resources'))
  logger.log('')
  logger.log(chalk.cyan('Documentation:'))
  logger.log('   • Doorman: https://doorman.griffen.codes')
  logger.log('   • Vercel Firewall: https://vercel.com/docs/security/vercel-firewall')
  logger.log('   • Cloudflare WAF: https://developers.cloudflare.com/waf')
  logger.log('')
  logger.log(chalk.cyan('Support:'))
  logger.log('   • GitHub: https://github.com/gfargo/vercel-doorman/issues')
  logger.log('   • Vercel: https://vercel.com/help')
  logger.log('   • Cloudflare: https://support.cloudflare.com')
  logger.log('')

  // Security Best Practices
  logger.log(chalk.bold('🔒 Security Best Practices'))
  logger.log('')
  logger.log('• Store API tokens securely (use environment variables)')
  logger.log('• Set token expiration dates')
  logger.log('• Use principle of least privilege for token scopes')
  logger.log('• Regularly rotate API tokens')
  logger.log('• Test rules in staging before production')
  logger.log('• Keep backups of working configurations')
  logger.log('• Use provider-specific validation before deploying')
  logger.log('')

  logger.log(chalk.bold.green('✅ Ready to get started?'))
  logger.log(chalk.dim('Run: ') + chalk.cyan('vercel-doorman init --interactive'))
  logger.log('')
}
