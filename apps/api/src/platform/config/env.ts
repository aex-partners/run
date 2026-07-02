import { z } from 'zod'

// Validated process env. Ported 1:1 from AEX's env.ts. Imported only by main and
// driven adapters — never by domain/application (which take config by injection).
const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  PORT: z.coerce.number().default(3001),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().min(1),
  CORS_ORIGIN: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().optional(),
  ENCRYPTION_KEY: z.string().optional(),
  EMAIL_ENCRYPTION_KEY: z.string().optional(),
  METRICS_TOKEN: z.string().optional(),
  // Platform-level payment/fiscal provider config (read by the driven adapters).
  // Sicredi's client_id/secret are AEX Run's parceiro APP registration (one app for
  // the software); each tenant/beneficiário plugs only its own account auth in the
  // credential store. Base URLs default to sandbox inside the adapters.
  SICREDI_CLIENT_ID: z.string().optional(),
  SICREDI_CLIENT_SECRET: z.string().optional(),
  SICREDI_BASE: z.string().optional(),
  PAGSEGURO_BASE: z.string().optional(),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
})

export type Env = z.infer<typeof envSchema>

export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env)
  if (!result.success) {
    console.error('Invalid environment variables:')
    console.error(result.error.flatten().fieldErrors)
    process.exit(1)
  }
  return result.data
}
