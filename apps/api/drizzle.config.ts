import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

if (!process.env.DATABASE_URL) {
  config({ path: '../../.env' })
}

// Schema lives in platform/db (infrastructure), imported by adapters only.
export default defineConfig({
  out: './drizzle',
  schema: [
    './src/platform/db/schema/auth.ts',
    './src/platform/db/schema/app.ts',
    './src/platform/db/schema/relations.ts',
  ],
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
