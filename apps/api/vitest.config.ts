import { defineConfig } from 'vitest/config'
import path from 'node:path'

// Test config for @aex/api. Resolves the `@/*` alias to src and runs every
// *.test.ts under src. Domain/application tests are pure (node env, fakes);
// adapter tests that need Postgres/Redis are opt-in and skip without infra.
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Domain/app are pure; keep runs fast and isolated.
    pool: 'threads',
  },
})
