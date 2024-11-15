import { createGenerator } from 'ts-json-schema-generator';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

const config = {
  path: resolve(__dirname, '../src/lib/types/configTypes.ts'),
  type: 'FirewallConfig',
  additionalProperties: false
};

const outputPath = resolve(__dirname, '../schema/firewall-config.schema.json');

const schema = createGenerator(config).createSchema(config.type);

// Add some metadata to the schema
const schemaWithMeta = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  ...schema,
  title: 'Vercel Doorman Firewall Configuration',
  description: 'Schema for vercel-doorman firewall configuration files'
};

writeFileSync(outputPath, JSON.stringify(schemaWithMeta, null, 2));
console.log(`Schema generated at ${outputPath}`);