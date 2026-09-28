import { z } from 'zod'

// Every VITE_* variable the app reads, validated once at startup. A missing or malformed
// value fails here with a clear message instead of as a confusing bug later.
// Add a variable: declare it here, in src/vite-env.d.ts, and in .env.example.
// `FOO=` in a .env file arrives as '', which should mean "not set", not a value.
const emptyToUndefined = (value: unknown) => (value === '' ? undefined : value)

export const envSchema = z.object({
  VITE_API_URL: z.string().min(1).default('/api'),
  VITE_API_MOCKING: z.enum(['enabled', 'disabled']).default('disabled'),
  // Error tracking (src/lib/monitoring.ts). Empty or unset → monitoring is off.
  VITE_SENTRY_DSN: z.preprocess(emptyToUndefined, z.url({ protocol: /^https?$/ }).optional()),
  VITE_SENTRY_TRACES_SAMPLE_RATE: z.preprocess(
    emptyToUndefined,
    z.coerce.number().min(0).max(1).default(0.1),
  ),
})

export const env = envSchema.parse(import.meta.env)

/**
 * Absolute base URL for API calls. VITE_API_URL may be relative ("/api", same origin, proxied
 * in dev) or absolute ("https://api.example.com"). Absolute is needed so Node's Request can
 * parse it in tests.
 */
export const apiBaseUrl = new URL(
  env.VITE_API_URL.replace(/\/$/, ''),
  globalThis.location?.origin ?? 'http://localhost',
).href.replace(/\/$/, '')
