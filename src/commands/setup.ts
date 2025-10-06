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
  logger.log(chalk.dim('Everything you need to get started with firewall management\n'))

  // Step 1: Prerequisites
  logger.log(chalk.bold('📋 Prerequisites'))
  logger.log('• Vercel account with a deployed project')
  logger.log('• Project with Pro plan or higher (firewall feature requirement)')
  logger.log('• Admin access to the project/team\n')

  // Step 2: Getting Project Information
  logger.log(chalk.bold('🔍 Finding Your Project Information'))
  logger.log('')

  logger.log(chalk.cyan('1. Project ID:'))
  logger.log('   • Go to https://vercel.com/dashboard')
  logger.log('   • Select your project')
  logger.log('   • Navigate to Settings → General')
  logger.log('   • Copy the Project ID from the top of the page')
  logger.log('')

  logger.log(chalk.cyan('2. Team ID (if using team account):'))
  logger.log('   • Go to https://vercel.com/dashboard')
  logger.log('   • Click on your team name in the top-left')
  logger.log('   • Go to Team Settings → General')
  logger.log('   • Copy the Team ID')
  logger.log('   • Leave empty if using personal account')
  logger.log('')

  // Step 3: API Token
  logger.log(chalk.bold('🔑 Creating API Token'))
  logger.log('')
  logger.log(chalk.cyan('Steps:'))
  logger.log('   1. Visit https://vercel.com/account/tokens')
  logger.log('   2. Click "Create Token"')
  logger.log('   3. Name: "Doorman Firewall Management"')
  logger.log('   4. Expiration: Set as needed (90 days recommended)')
  logger.log('   5. Scope: Select your project or team')
  logger.log('   6. Copy the generated token')
  logger.log('')

  logger.log(chalk.cyan('Required Permissions:'))
  logger.log('   • Read access to project settings')
  logger.log('   • Write access to firewall configuration')
  logger.log('')

  // Step 4: Environment Setup
  logger.log(chalk.bold('🌍 Environment Setup'))
  logger.log('')
  logger.log(chalk.cyan('Set your API token as environment variable:'))
  logger.log('')
  logger.log(chalk.green('# For current session:'))
  logger.log('export VERCEL_TOKEN="your-token-here"')
  logger.log('')
  logger.log(chalk.green('# For permanent setup (add to ~/.bashrc or ~/.zshrc):'))
  logger.log('echo \'export VERCEL_TOKEN="your-token-here"\' >> ~/.bashrc')
  logger.log('')
  logger.log(chalk.green('# Or create a .env file in your project:'))
  logger.log('echo "VERCEL_TOKEN=your-token-here" > .env')
  logger.log('')

  // Step 5: Quick Start
  logger.log(chalk.bold('🚀 Quick Start Commands'))
  logger.log('')
  logger.log(chalk.cyan('1. Initialize configuration:'))
  logger.log('   vercel-doorman init --interactive')
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

  // Step 6: Troubleshooting
  logger.log(chalk.bold('🔧 Common Issues'))
  logger.log('')
  logger.log(chalk.yellow('❌ "Project not found" error:'))
  logger.log('   • Double-check your Project ID')
  logger.log('   • Ensure your token has access to the project')
  logger.log('   • Verify the project has Pro plan or higher')
  logger.log('')
  logger.log(chalk.yellow('❌ "Unauthorized" error:'))
  logger.log('   • Check your VERCEL_TOKEN is set correctly')
  logger.log("   • Ensure token hasn't expired")
  logger.log('   • Verify token has firewall permissions')
  logger.log('')
  logger.log(chalk.yellow('❌ "Firewall not available" error:'))
  logger.log('   • Upgrade to Pro plan or higher')
  logger.log('   • Contact Vercel support if issue persists')
  logger.log('')

  // Step 7: Additional Resources
  logger.log(chalk.bold('📚 Additional Resources'))
  logger.log('')
  logger.log(chalk.cyan('Documentation:'))
  logger.log('   • Doorman Docs: https://doorman.griffen.codes')
  logger.log('   • Vercel Firewall: https://vercel.com/docs/security/vercel-firewall')
  logger.log('   • API Reference: https://vercel.com/docs/rest-api/endpoints/firewall')
  logger.log('')
  logger.log(chalk.cyan('Support:'))
  logger.log('   • GitHub Issues: https://github.com/gfargo/vercel-doorman/issues')
  logger.log('   • Vercel Support: https://vercel.com/help')
  logger.log('')

  // Step 8: Security Best Practices
  logger.log(chalk.bold('🔒 Security Best Practices'))
  logger.log('')
  logger.log('• Store API tokens securely (use environment variables)')
  logger.log('• Set token expiration dates')
  logger.log('• Use principle of least privilege for token scopes')
  logger.log('• Regularly rotate API tokens')
  logger.log('• Test rules in staging before production')
  logger.log('• Keep backups of working configurations')
  logger.log('')

  logger.log(chalk.bold.green('✅ Ready to get started?'))
  logger.log(chalk.dim('Run: ') + chalk.cyan('vercel-doorman init --interactive'))
  logger.log('')
}
