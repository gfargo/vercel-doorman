# CloudflareValidator

The `CloudflareValidator` service provides comprehensive validation for Cloudflare credentials and configuration. It's designed to help users quickly identify and resolve credential and configuration issues before attempting to use Cloudflare WAF operations.

## Features

- **API Token Validation**: Checks token format, validity, and permissions
- **Zone Access Validation**: Verifies zone exists and is accessible with proper permissions
- **Account Access Validation**: Validates account access for Lists API functionality
- **Permission Checking**: Ensures API token has required permissions for different operations
- **Detailed Error Reporting**: Provides actionable suggestions and documentation links
- **Graceful Degradation**: Handles optional features (like Lists API) gracefully

## Usage

### Basic Validation

```typescript
import { CloudflareValidator } from './CloudflareValidator'
import type { CloudflareCredentials } from './CloudflareValidator'

const validator = new CloudflareValidator()

const credentials: CloudflareCredentials = {
  apiToken: 'your-api-token',
  zoneId: 'your-zone-id',
  accountId: 'your-account-id', // Optional
}

const result = await validator.validateCredentials(credentials)

if (result.valid) {
  console.log('✅ Credentials are valid!')
} else {
  console.log('❌ Validation failed:')
  result.errors.forEach((error) => {
    console.log(`- ${error.message}`)
    console.log(`  Suggestion: ${error.suggestion}`)
  })
}
```

### Individual Validations

```typescript
// Validate just zone access
const zoneResult = await validator.validateZoneAccess(zoneId, apiToken)

// Validate just account access
const accountResult = await validator.validateAccountAccess(accountId, apiToken)
```

## Validation Result Structure

```typescript
interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  suggestions: string[]
}

interface ValidationError {
  field: string
  message: string
  suggestion: string
  docsUrl?: string
}

interface ValidationWarning {
  field: string
  message: string
  impact: string
}
```

## Required Permissions

The validator checks for these minimum permissions:

### Zone Operations

- `Zone:Edit` - Required for creating and modifying firewall rules
- `Zone:Read` - Required for reading zone information (usually included with Zone:Edit)

### Lists API (Optional)

- `Account:Read` - Required for accessing Lists API for efficient IP blocking

## Error Handling

The validator provides detailed error information with:

- **Specific error messages** explaining what went wrong
- **Actionable suggestions** on how to fix the issue
- **Documentation links** for detailed setup instructions
- **Impact assessment** for warnings about optional features

## Common Validation Scenarios

### 1. Invalid API Token Format

```typescript
// Token with "Bearer " prefix
const result = await validator.validateCredentials({
  apiToken: 'Bearer your-token',
  zoneId: 'zone-id',
})
// Error: "API token should not include 'Bearer ' prefix"
```

### 2. Insufficient Permissions

```typescript
// Token without Zone:Edit permission
// Error: "API token lacks Zone:Edit permission"
// Suggestion: "Add Zone:Edit permission to your API token in the Cloudflare dashboard"
```

### 3. Missing Account ID

```typescript
// No account ID provided
// Warning: "Account ID not provided"
// Impact: "Lists API will not be available - IP blocking will use individual rules"
```

### 4. Zone Not Found

```typescript
// Invalid zone ID
// Error: "Zone not found or not accessible"
// Suggestion: "Check that the zone ID is correct and the API token has access to this zone"
```

## Integration with Commands

The validator is designed to be integrated into CLI commands for early validation:

```typescript
// In init command
const validator = new CloudflareValidator()
const result = await validator.validateCredentials(credentials)

if (!result.valid) {
  // Show errors and exit before creating configuration
  result.errors.forEach((error) => console.error(error.message))
  process.exit(1)
}

// Show warnings but continue
result.warnings.forEach((warning) => console.warn(warning.message))
```

## Testing

The validator includes comprehensive unit tests covering:

- Valid credential scenarios
- Various error conditions
- Network failure handling
- Permission checking
- Token format validation
- Zone and account access validation

Run tests with:

```bash
npm test -- --testPathPattern="CloudflareValidator.test.ts"
```

## Documentation Links

The validator provides links to relevant documentation sections:

- Setup guide: `https://docs.doorman.griffen.codes/cloudflare/setup`
- Troubleshooting: `https://docs.doorman.griffen.codes/cloudflare/troubleshooting`
- API token creation: `https://docs.doorman.griffen.codes/cloudflare/setup#api-token`
- Permissions setup: `https://docs.doorman.griffen.codes/cloudflare/setup#permissions`
