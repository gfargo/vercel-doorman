import globals from 'globals'
import tseslint from 'typescript-eslint'
import eslintConfigPrettier from 'eslint-config-prettier'
import eslintPluginPrettier from 'eslint-plugin-prettier/recommended'
import jest from 'eslint-plugin-jest'
import unusedImports from 'eslint-plugin-unused-imports'

export default tseslint.config(
  { ignores: ['dist/**', 'bundle/**', 'coverage/**', '.yarn/**', 'CHANGELOG.md', 'test-sync-fix.js'] },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: { ...globals.node },
      parserOptions: { sourceType: 'module' },
    },
  },
  ...tseslint.configs.recommended,
  eslintConfigPrettier,
  eslintPluginPrettier,
  {
    plugins: { 'unused-imports': unusedImports },
    rules: {
      'no-console': 'warn',
      'prettier/prettier': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'src/tests/**/*.ts'],
    ...jest.configs['flat/recommended'],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      ...jest.configs['flat/recommended'].rules,
      'jest/no-conditional-expect': 'off',
    },
  },
)
