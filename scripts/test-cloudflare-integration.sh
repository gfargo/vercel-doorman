#!/bin/bash

# Cloudflare Integration Test Script
# Tests all major command workflows with Cloudflare provider

set -e

echo "🧪 Testing Cloudflare Integration"
echo "================================="

# Check required environment variables
if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
    echo "❌ CLOUDFLARE_API_TOKEN environment variable is required"
    exit 1
fi

if [ -z "$CLOUDFLARE_ZONE_ID" ]; then
    echo "❌ CLOUDFLARE_ZONE_ID environment variable is required"
    exit 1
fi

echo "✅ Environment variables configured"

# Build the project
echo ""
echo "🔨 Building project..."
npm run build

# Test 1: Health check
echo ""
echo "🏥 Testing health command..."
npm run cli health --provider cloudflare --quick

# Test 2: Validate command
echo ""
echo "🔍 Testing validate command..."
npm run cli validate --provider cloudflare

# Test 3: List command
echo ""
echo "📋 Testing list command..."
npm run cli list --provider cloudflare --format json > /tmp/cloudflare-rules.json
echo "✅ Rules exported to /tmp/cloudflare-rules.json"

# Test 4: Status command
echo ""
echo "📊 Testing status command..."
npm run cli status --provider cloudflare

# Test 5: Diff command (should show no changes for current config)
echo ""
echo "🔄 Testing diff command..."
npm run cli diff --provider cloudflare

# Test 6: Backup command
echo ""
echo "💾 Testing backup command..."
npm run cli backup --provider cloudflare --output /tmp/cloudflare-backup

# Test 7: Export command
echo ""
echo "📤 Testing export command..."
npm run cli export --provider cloudflare --source remote --format json --output /tmp/cloudflare-export.json

# Test 8: Template validation (dry run)
echo ""
echo "📝 Testing template command..."
npm run cli template ai-bots --provider cloudflare --dry-run

# Test 9: Init command validation
echo ""
echo "🚀 Testing init command validation..."
npm run cli init --provider cloudflare --validate-only

# Test 10: Run comprehensive E2E validation
echo ""
echo "🎯 Running comprehensive E2E validation..."
npx tsx src/scripts/cloudflare-e2e-validation.ts

echo ""
echo "🎉 All Cloudflare integration tests passed!"
echo "✅ Ready for production deployment"