import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { createGenerator } from 'ts-json-schema-generator'

const config = {
  path: resolve(__dirname, '../src/lib/types/configTypes.ts'),
  type: 'FirewallConfig',
  additionalProperties: false,
}

const schemaOutputPath = resolve(__dirname, '../schema/firewall-config.schema.json')
const schemaAsVariableOutputPath = resolve(__dirname, '../src/constants/schema.ts')

const schema = createGenerator(config).createSchema(config.type)

// Add some metadata to the schema
const schemaWithMeta = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Vercel Doorman Firewall Configuration',
  description: 'Schema for vercel-doorman firewall configuration files',
  ...schema,
}

const schemaAsVariable = `export const schema = ${JSON.stringify(schemaWithMeta, null, 2)}`

writeFileSync(schemaOutputPath, JSON.stringify(schemaWithMeta, null, 2))
writeFileSync(schemaAsVariableOutputPath, schemaAsVariable)

// eslint-disable-next-line no-console
console.log(`Schema generated at ${schemaOutputPath}`)
