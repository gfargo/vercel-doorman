import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['bin/run.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
})
