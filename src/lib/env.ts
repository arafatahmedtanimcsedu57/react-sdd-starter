import { z } from 'zod'

// Every VITE_* variable the app reads, validated once at startup. A missing or malformed
// value fails here with a clear message instead of as a confusing bug later.
// Add a variable: declare it here, in src/vite-env.d.ts, and in .env.example.
const envSchema = z.object({
  VITE_API_URL: z.string().min(1).default('/api'),
  VITE_API_MOCKING: z.enum(['enabled', 'disabled']).default('disabled'),
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
