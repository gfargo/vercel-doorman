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
  title: 'Doorman Config',
  description: 'Schema for vercel-doorman project configuration files',
  ...schema,
}

// Write the schema to a file as a variable so it can be used for validation.
const schemaAsVariable = `export const schema = ${JSON.stringify(schemaWithMeta, null, 2)}`
writeFileSync(schemaAsVariableOutputPath, schemaAsVariable)

writeFileSync(schemaOutputPath, JSON.stringify(schemaWithMeta, null, 2))

// eslint-disable-next-line no-console
console.log(`\x1b[32m✨ Schema generated at \x1b[1m${schemaOutputPath}\x1b[0m\x1b[32m\x1b[0m`)
