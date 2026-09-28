import { describe, it, expect } from 'vitest'
import { apiBaseUrl, env, envSchema } from './env'

describe('env', () => {
  it('defaults the API to same-origin /api', () => {
    expect(env.VITE_API_URL).toBe('/api')
    expect(apiBaseUrl).toBe('http://localhost:5173/api')
  })

  describe('Sentry settings', () => {
    it('treats an unset or empty DSN as off', () => {
      expect(envSchema.parse({}).VITE_SENTRY_DSN).toBeUndefined()
      expect(envSchema.parse({ VITE_SENTRY_DSN: '' }).VITE_SENTRY_DSN).toBeUndefined()
    })

    it('accepts an https DSN and rejects anything else', () => {
      const dsn = 'https://public@o1.ingest.sentry.io/1'
      expect(envSchema.parse({ VITE_SENTRY_DSN: dsn }).VITE_SENTRY_DSN).toBe(dsn)
      expect(() => envSchema.parse({ VITE_SENTRY_DSN: 'not-a-url' })).toThrow()
      expect(() => envSchema.parse({ VITE_SENTRY_DSN: 'mailto:a@b.c' })).toThrow()
    })

    it('defaults the trace sample rate to 0.1 when unset or empty', () => {
      expect(envSchema.parse({}).VITE_SENTRY_TRACES_SAMPLE_RATE).toBe(0.1)
      expect(
        envSchema.parse({ VITE_SENTRY_TRACES_SAMPLE_RATE: '' }).VITE_SENTRY_TRACES_SAMPLE_RATE,
      ).toBe(0.1)
    })

    it('reads the sample rate as a number between 0 and 1', () => {
      expect(
        envSchema.parse({ VITE_SENTRY_TRACES_SAMPLE_RATE: '0' }).VITE_SENTRY_TRACES_SAMPLE_RATE,
      ).toBe(0)
      expect(() => envSchema.parse({ VITE_SENTRY_TRACES_SAMPLE_RATE: '2' })).toThrow()
    })
  })
})
