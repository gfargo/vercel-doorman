#!/usr/bin/env node

/**
 * Example usage of CloudflareValidator
 *
 * This example demonstrates how to use the CloudflareValidator service
 * to validate Cloudflare credentials and configuration.
 */

import { CloudflareValidator } from '../src/lib/providers/cloudflare/CloudflareValidator'
import type { CloudflareCredentials } from '../src/lib/providers/cloudflare/CloudflareValidator'

async function main() {
  const validator = new CloudflareValidator()

  // Example credentials (replace with your actual credentials)
  const credentials: CloudflareCredentials = {
    apiToken: process.env.CLOUDFLARE_API_TOKEN || 'your-api-token-here',
    zoneId: process.env.CLOUDFLARE_ZONE_ID || 'your-zone-id-here',
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID, // Optional
  }

  console.log('🔍 Validating Cloudflare credentials...\n')

  try {
    // Validate all credentials
    const result = await validator.validateCredentials(credentials)

    if (result.valid) {
      console.log('✅ All credentials are valid!')

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:')
        result.warnings.forEach((warning) => {
          console.log(`   • ${warning.message}`)
          console.log(`     Impact: ${warning.impact}`)
        })
      }

      if (result.suggestions.length > 0) {
        console.log('\n💡 Suggestions:')
        result.suggestions.forEach((suggestion) => {
          console.log(`   • ${suggestion}`)
        })
      }
    } else {
      console.log('❌ Credential validation failed!')

      console.log('\n🚨 Errors:')
      result.errors.forEach((error) => {
        console.log(`   • ${error.message}`)
        console.log(`     Suggestion: ${error.suggestion}`)
        if (error.docsUrl) {
          console.log(`     Documentation: ${error.docsUrl}`)
        }
      })

      if (result.warnings.length > 0) {
        console.log('\n⚠️  Warnings:')
        result.warnings.forEach((warning) => {
          console.log(`   • ${warning.message}`)
          console.log(`     Impact: ${warning.impact}`)
        })
      }
    }
  } catch (error) {
    console.error('💥 Unexpected error during validation:', error)
  }

  // Example: Validate just zone access
  console.log('\n🔍 Testing zone access separately...')
  try {
    const zoneResult = await validator.validateZoneAccess(credentials.zoneId, credentials.apiToken)

    if (zoneResult.valid) {
      console.log('✅ Zone access is valid!')
    } else {
      console.log('❌ Zone access validation failed!')
      zoneResult.errors.forEach((error) => {
        console.log(`   • ${error.message}`)
      })
    }
  } catch (error) {
    console.error('💥 Zone validation error:', error)
  }

  // Example: Validate account access if account ID is provided
  if (credentials.accountId) {
    console.log('\n🔍 Testing account access separately...')
    try {
      const accountResult = await validator.validateAccountAccess(credentials.accountId, credentials.apiToken)

      if (accountResult.valid) {
        console.log('✅ Account access is valid!')
        console.log('   Lists API is available for efficient IP blocking')
      } else {
        console.log('❌ Account access validation failed!')
        accountResult.errors.forEach((error) => {
          console.log(`   • ${error.message}`)
        })
      }
    } catch (error) {
      console.error('💥 Account validation error:', error)
    }
  } else {
    console.log('\n💡 Account ID not provided - Lists API will not be available')
    console.log('   Consider setting CLOUDFLARE_ACCOUNT_ID for better performance with large IP lists')
  }
}

// Run the example
if (require.main === module) {
  main().catch(console.error)
}

export { main }
