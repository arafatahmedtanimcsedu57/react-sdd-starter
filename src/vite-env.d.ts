/// <reference types="vite/client" />

// Keep in sync with the Zod schema in src/lib/env.ts and with .env.example.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_API_MOCKING?: 'enabled' | 'disabled'
  readonly VITE_SENTRY_DSN?: string
  readonly VITE_SENTRY_TRACES_SAMPLE_RATE?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
