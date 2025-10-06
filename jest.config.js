/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/dist/'],
  moduleNameMapper: {
    '^chalk$': '<rootDir>/src/tests/__mocks__/chalk.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(find-up)/)'],
}
