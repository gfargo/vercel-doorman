import chalk from 'chalk'
import { existsSync } from 'fs'
import { Arguments } from 'yargs'
import { logger } from '../lib/logger'
import { prompt } from '../lib/ui/prompt'
import { createEmptyConfig } from '../lib/utils/createEmptyConfig'
import { saveConfig } from '../lib/utils/config'
import { ErrorFormatter } from '../lib/utils/errorFormatter'
import { getProviderDisplayName } from '../lib/utils/providerHelper'

interface InitOptions {
  config?: string
  force?: boolean
  template?: string
  interactive?: boolean
  provider?: 'vercel' | 'cloudflare'
  // Vercel options
  projectId?: string
  teamId?: string
  // Cloudflare options
  zoneId?: string
  accountId?: string
}

export const command = 'init [template]'
export const desc = 'Initialize a new Vercel Doorman configuration'

export const builder = {
  template: {
    type: 'string',
    description: 'Template to use for initialization (empty, basic, or security-focused)',
    choices: ['empty', 'basic', 'security-focused'],
    default: 'empty',
  },
  config: {
    alias: 'c',
    type: 'string',
    description: 'Path for the new config file',
    default: 'vercel-firewall.config.json',
  },
  force: {
    alias: 'f',
    type: 'boolean',
    description: 'Overwrite existing config file',
    default: false,
  },
  interactive: {
    alias: 'i',
    type: 'boolean',
    description: 'Interactive setup with guided prompts',
    default: true,
  },
  provider: {
    type: 'string',
    description: 'Firewall provider (vercel or cloudflare)',
    choices: ['vercel', 'cloudflare'],
  },
  // Vercel options
  projectId: {
    alias: 'p',
    type: 'string',
    description: 'Vercel Project ID',
  },
  teamId: {
    alias: 't',
    type: 'string',
    description: 'Vercel Team ID',
  },
  // Cloudflare options
  zoneId: {
    type: 'string',
    description: 'Cloudflare Zone ID',
  },
  accountId: {
    type: 'string',
    description: 'Cloudflare Account ID (optional)',
  },
}

const showWelcomeMessage = (providerName: string) => {
  logger.log('')
  logger.log(chalk.bold.cyan('🚪 Welcome to Vercel Doorman!'))
  logger.log(chalk.dim(`Let's set up your ${providerName} firewall configuration.\n`))
}

const showHelpLinks = (provider: 'vercel' | 'cloudflare') => {
  logger.log(chalk.bold('\n📚 Helpful Resources:'))
  logger.log('')

  if (provider === 'vercel') {
    logger.log(chalk.cyan('🔗 Find your Project ID:'))
    logger.log(chalk.dim('   https://vercel.com/dashboard → Select your project → Settings → General'))
    logger.log('')
    logger.log(chalk.cyan('🔗 Find your Team ID:'))
    logger.log(chalk.dim('   https://vercel.com/dashboard → Team Settings → General'))
    logger.log(chalk.dim('   (Leave empty if using personal account)'))
    logger.log('')
    logger.log(chalk.cyan('🔗 Create API Token:'))
    logger.log(chalk.dim('   https://vercel.com/account/tokens → Create Token'))
    logger.log(chalk.dim('   Scopes needed: Read & Write for your project'))
  } else {
    logger.log(chalk.cyan('🔗 Find your Zone ID:'))
    logger.log(chalk.dim('   https://dash.cloudflare.com → Select domain → Overview (right sidebar)'))
    logger.log('')
    logger.log(chalk.cyan('🔗 Find your Account ID:'))
    logger.log(chalk.dim('   https://dash.cloudflare.com → Select domain → Overview (right sidebar)'))
    logger.log('')
    logger.log(chalk.cyan('🔗 Create API Token:'))
    logger.log(chalk.dim('   https://dash.cloudflare.com/profile/api-tokens → Create Token'))
    logger.log(chalk.dim('   Template: Edit zone DNS + Account Firewall'))
  }

  logger.log('')
  logger.log(chalk.cyan('🔗 Documentation:'))
  logger.log(chalk.dim('   https://doorman.griffen.codes/getting-started'))
  logger.log('')
}

const promptForProviderDetails = async (argv: Arguments<InitOptions>, provider: 'vercel' | 'cloudflare') => {
  const providerName = getProviderDisplayName(provider)

  if (argv.interactive) {
    logger.log(chalk.bold('📋 Provider Configuration'))
    logger.log(chalk.dim(`We need your ${providerName} details to configure the firewall.\n`))
  }

  if (provider === 'vercel') {
    let projectId = argv.projectId
    let teamId = argv.teamId

    if (argv.interactive) {
      if (!projectId) {
        projectId = await prompt('Enter your Vercel Project ID:', {
          type: 'input',
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Project ID is required'
            }
            if (input.length < 10) {
              return 'Project ID seems too short. Please double-check.'
            }
            return true
          },
        })
      }

      if (!teamId) {
        const hasTeam = await prompt('Are you using a Vercel team account?', {
          type: 'confirm',
        })

        if (hasTeam) {
          teamId = await prompt('Enter your Vercel Team ID:', {
            type: 'input',
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return 'Team ID is required when using team account'
              }
              return true
            },
          })
        }
      }

      // Validate environment variable setup
      const hasToken = process.env.VERCEL_TOKEN
      if (!hasToken) {
        logger.log('')
        logger.log(chalk.yellow('⚠️  VERCEL_TOKEN environment variable not found'))
        logger.log(chalk.dim("You'll need to set this before running sync commands."))

        const showTokenHelp = await prompt('Would you like to see how to create an API token?', {
          type: 'confirm',
        })

        if (showTokenHelp) {
          logger.log('')
          logger.log(chalk.bold('🔑 Creating a Vercel API Token:'))
          logger.log('1. Go to https://vercel.com/account/tokens')
          logger.log('2. Click "Create Token"')
          logger.log('3. Give it a descriptive name (e.g., "Doorman Firewall")')
          logger.log('4. Set expiration as needed')
          logger.log('5. Copy the token and set it as an environment variable:')
          logger.log('')
          logger.log(chalk.cyan('   export VERCEL_TOKEN="your-token-here"'))
          logger.log(chalk.dim('   # Add this to your ~/.bashrc, ~/.zshrc, or .env file'))
          logger.log('')
        }
      } else {
        logger.log(chalk.green('✅ VERCEL_TOKEN environment variable found'))
      }
    }

    return { projectId, teamId, zoneId: undefined, accountId: undefined }
  } else {
    // Cloudflare
    let zoneId = argv.zoneId
    let accountId = argv.accountId

    if (argv.interactive) {
      if (!zoneId) {
        zoneId = await prompt('Enter your Cloudflare Zone ID:', {
          type: 'input',
          validate: (input: string) => {
            if (!input || input.trim().length === 0) {
              return 'Zone ID is required'
            }
            if (input.length < 10) {
              return 'Zone ID seems too short. Please double-check.'
            }
            return true
          },
        })
      }

      if (!accountId) {
        const needsAccount = await prompt('Do you have a Cloudflare Account ID?', {
          type: 'confirm',
        })

        if (needsAccount) {
          accountId = await prompt('Enter your Cloudflare Account ID:', {
            type: 'input',
          })
        }
      }

      // Validate environment variable setup
      const hasToken = process.env.CLOUDFLARE_API_TOKEN
      if (!hasToken) {
        logger.log('')
        logger.log(chalk.yellow('⚠️  CLOUDFLARE_API_TOKEN environment variable not found'))
        logger.log(chalk.dim("You'll need to set this before running sync commands."))

        const showTokenHelp = await prompt('Would you like to see how to create an API token?', {
          type: 'confirm',
        })

        if (showTokenHelp) {
          logger.log('')
          logger.log(chalk.bold('🔑 Creating a Cloudflare API Token:'))
          logger.log('1. Go to https://dash.cloudflare.com/profile/api-tokens')
          logger.log('2. Click "Create Token"')
          logger.log('3. Use "Edit zone DNS" + "Account Firewall" template')
          logger.log('4. Select your zone and account')
          logger.log('5. Copy the token and set it as an environment variable:')
          logger.log('')
          logger.log(chalk.cyan('   export CLOUDFLARE_API_TOKEN="your-token-here"'))
          logger.log(chalk.dim('   # Add this to your ~/.bashrc, ~/.zshrc, or .env file'))
          logger.log('')
        }
      } else {
        logger.log(chalk.green('✅ CLOUDFLARE_API_TOKEN environment variable found'))
      }
    }

    return { projectId: undefined, teamId: undefined, zoneId, accountId }
  }
}

export const handler = async (argv: Arguments<InitOptions>) => {
  try {
    const configPath = argv.config || 'vercel-firewall.config.json'

    // Select provider
    let provider: 'vercel' | 'cloudflare' = argv.provider || 'vercel'
    if (argv.interactive && !argv.provider) {
      provider = await prompt('Select your firewall provider:', {
        type: 'select',
        choices: [
          { title: 'Vercel Firewall', value: 'vercel' },
          { title: 'Cloudflare WAF', value: 'cloudflare' },
        ],
      })
    }

    const providerName = getProviderDisplayName(provider)

    if (argv.interactive) {
      showWelcomeMessage(providerName)
    }

    // Check if config already exists
    if (existsSync(configPath) && !argv.force) {
      const overwrite = await prompt(`Config file ${configPath} already exists. Do you want to overwrite it?`, {
        type: 'confirm',
      })

      if (!overwrite) {
        logger.info(chalk.yellow('Initialization cancelled.'))
        return
      }
    }

    // Get provider details
    const { projectId, teamId, zoneId, accountId } = await promptForProviderDetails(argv, provider)

    if (argv.interactive) {
      logger.log('')
      logger.log(chalk.bold('🎨 Template Selection'))
      logger.log(chalk.dim('Choose a starting template for your firewall configuration:\n'))

      logger.log(chalk.cyan('📝 empty') + chalk.dim(' - Minimal config, add your own rules'))
      logger.log(chalk.cyan('🛡️  basic') + chalk.dim(' - Includes basic bot protection'))
      logger.log(chalk.cyan('🔒 security-focused') + chalk.dim(' - Comprehensive security rules'))
      logger.log('')
    }

    // Allow template selection in interactive mode
    let template = argv.template
    if (argv.interactive && !argv.template) {
      template = await prompt('Select a template:', {
        type: 'select',
        choices: [
          { title: 'Empty - Start from scratch', value: 'empty' },
          { title: 'Basic - Simple bot protection', value: 'basic' },
          { title: 'Security-focused - Comprehensive rules', value: 'security-focused' },
        ],
      })
    }

    logger.start(`Creating ${template} configuration for ${providerName}...`)

    let config = createEmptyConfig()

    // Set provider
    config.provider = provider

    // Set provider-specific details
    if (provider === 'vercel') {
      if (projectId) {
        config.projectId = projectId
      }
      if (teamId) {
        config.teamId = teamId
      }
    } else {
      if (zoneId) {
        config.zoneId = zoneId
      }
      if (accountId) {
        config.accountId = accountId
      }
    }

    // Add template-specific content
    switch (template) {
      case 'basic':
        config = {
          ...config,
          rules: [
            {
              id: 'rule_block_bad_bots',
              name: 'Block Bad Bots',
              description: 'Block known malicious bots and crawlers based on user agent patterns',
              conditionGroup: [
                {
                  conditions: [
                    {
                      type: 'user_agent',
                      op: 'sub',
                      value: 'bot',
                    },
                  ],
                },
              ],
              action: {
                mitigate: {
                  action: 'deny',
                },
              },
              active: false, // Start disabled for safety
            },
            {
              id: 'rule_block_scrapers',
              name: 'Block Scrapers',
              description: 'Block common scraping tools and automated requests',
              conditionGroup: [
                {
                  conditions: [
                    {
                      type: 'user_agent',
                      op: 'sub',
                      value: 'scraper',
                    },
                  ],
                },
              ],
              action: {
                mitigate: {
                  action: 'deny',
                },
              },
              active: false,
            },
          ],
        }
        break

      case 'security-focused':
        config = {
          ...config,
          rules: [
            {
              id: 'rule_rate_limit_api',
              name: 'Rate Limit API',
              description: 'Rate limit API endpoints to prevent abuse and DoS attacks',
              conditionGroup: [
                {
                  conditions: [
                    {
                      type: 'path',
                      op: 'pre',
                      value: '/api/',
                    },
                  ],
                },
              ],
              action: {
                mitigate: {
                  action: 'rate_limit',
                  rateLimit: {
                    requests: 100,
                    window: '1m',
                  },
                },
              },
              active: false,
            },
            {
              id: 'rule_block_suspicious_ips',
              name: 'Block Suspicious IPs',
              description: 'Block requests from known suspicious IP ranges',
              conditionGroup: [
                {
                  conditions: [
                    {
                      type: 'ip_address',
                      op: 'sub',
                      value: '10.0.0.',
                    },
                  ],
                },
              ],
              action: {
                mitigate: {
                  action: 'deny',
                },
              },
              active: false,
            },
            {
              id: 'rule_protect_admin',
              name: 'Protect Admin Routes',
              description: 'Add extra protection for admin and sensitive routes',
              conditionGroup: [
                {
                  conditions: [
                    {
                      type: 'path',
                      op: 'pre',
                      value: '/admin',
                    },
                  ],
                },
              ],
              action: {
                mitigate: {
                  action: 'rate_limit',
                  rateLimit: {
                    requests: 10,
                    window: '1m',
                  },
                },
              },
              active: false,
            },
          ],
        }
        break

      default:
        // 'empty' template - already created by createEmptyConfig()
        break
    }

    await saveConfig(config, configPath)

    logger.success(chalk.green(`✅ Created ${configPath}`))

    // Show configuration summary
    logger.log('')
    logger.log(chalk.bold('📋 Configuration Summary:'))
    logger.log(`${chalk.dim('File:')} ${configPath}`)
    logger.log(`${chalk.dim('Provider:')} ${providerName}`)
    logger.log(`${chalk.dim('Template:')} ${template}`)

    if (provider === 'vercel') {
      logger.log(`${chalk.dim('Project ID:')} ${projectId || chalk.yellow('Not set - add manually')}`)
      logger.log(`${chalk.dim('Team ID:')} ${teamId || chalk.dim('None (personal account)')}`)
    } else {
      logger.log(`${chalk.dim('Zone ID:')} ${zoneId || chalk.yellow('Not set - add manually')}`)
      logger.log(`${chalk.dim('Account ID:')} ${accountId || chalk.dim('None (optional)')}`)
    }

    logger.log(`${chalk.dim('Rules:')} ${config.rules.length} (all disabled for safety)`)

    logger.log('')
    logger.log(chalk.bold('🚀 Next Steps:'))

    const envVar = provider === 'vercel' ? 'VERCEL_TOKEN' : 'CLOUDFLARE_API_TOKEN'
    const missingId = provider === 'vercel' ? !projectId : !zoneId
    const hasEnvVar = provider === 'vercel' ? process.env.VERCEL_TOKEN : process.env.CLOUDFLARE_API_TOKEN

    if (missingId) {
      const idField = provider === 'vercel' ? 'projectId' : 'zoneId'
      logger.log(`1. ${chalk.yellow(`Add your ${idField}`)} to ${configPath}`)
    }

    if (!hasEnvVar) {
      logger.log(`${missingId ? '2' : '1'}. ${chalk.yellow(`Set ${envVar}`)} environment variable`)
    }

    const nextStep = missingId ? 3 : !hasEnvVar ? 2 : 1
    logger.log(`${nextStep}. ${chalk.dim('Review and enable rules in')} ${configPath}`)
    logger.log(
      `${nextStep + 1}. ${chalk.dim('Run')} ${chalk.cyan('vercel-doorman validate')} ${chalk.dim('to check your config')}`,
    )
    logger.log(
      `${nextStep + 2}. ${chalk.dim('Run')} ${chalk.cyan('vercel-doorman status')} ${chalk.dim('to see sync status')}`,
    )
    logger.log(
      `${nextStep + 3}. ${chalk.dim('Run')} ${chalk.cyan('vercel-doorman sync')} ${chalk.dim('to deploy your rules')}`,
    )

    if (template !== 'empty') {
      logger.log('')
      logger.log(chalk.yellow('⚠️  All template rules are disabled by default for safety.'))
      logger.log(chalk.dim('   Review each rule and set active: true when ready.'))
    }

    // Show help links if interactive
    if (argv.interactive && (missingId || !hasEnvVar)) {
      showHelpLinks(provider)
    }
  } catch (error) {
    logger.error(
      ErrorFormatter.wrapErrorBlock([
        'Error initializing configuration:',
        `  ${error instanceof Error ? error.message : String(error)}`,
      ]),
    )
    process.exit(1)
  }
}
