import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

// Integration tests run against the LOCAL Supabase Postgres (`supabase start`
// + `npm run db:local:reset`). Env comes from .env.development.local.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.ts'],
    env: loadEnv('development', process.cwd(), ''),
    fileParallelism: false,
    testTimeout: 15_000,
  },
})
