import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const sentry = vi.hoisted(() => ({
  init: vi.fn(),
  captureException: vi.fn(),
  browserTracingIntegration: vi.fn(() => ({ name: 'BrowserTracing' })),
}))
vi.mock('@sentry/react', () => sentry)

async function loadMonitoring(dsn?: string) {
  vi.resetModules()
  if (dsn) vi.stubEnv('VITE_SENTRY_DSN', dsn)
  return import('./monitoring')
}

describe('monitoring', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  describe('without a DSN', () => {
    it('does not start Sentry', async () => {
      const { initMonitoring } = await loadMonitoring()
      await initMonitoring()
      expect(sentry.init).not.toHaveBeenCalled()
    })

    it('logs reported errors to the console instead', async () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { reportError } = await loadMonitoring()
      const error = new Error('boom')
      await reportError(error)
      expect(log).toHaveBeenCalledWith(error)
      expect(sentry.captureException).not.toHaveBeenCalled()
    })
  })

  describe('with a DSN', () => {
    const dsn = 'https://public@o1.ingest.sentry.io/1'

    it('starts Sentry with the DSN and the Vite mode as environment', async () => {
      const { initMonitoring } = await loadMonitoring(dsn)
      await initMonitoring()
      expect(sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ dsn, environment: import.meta.env.MODE }),
      )
    })

    it('sends reported errors to Sentry', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const { reportError } = await loadMonitoring(dsn)
      const error = new Error('boom')
      await reportError(error)
      expect(sentry.captureException).toHaveBeenCalledWith(error)
    })
  })

  it('waits for init when an error is reported before monitoring has started', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { reportError } = await loadMonitoring('https://public@o1.ingest.sentry.io/1')
    await reportError(new Error('early'))
    expect(sentry.init).toHaveBeenCalledTimes(1)
    expect(sentry.init.mock.invocationCallOrder[0]).toBeLessThan(
      sentry.captureException.mock.invocationCallOrder[0],
    )
  })

  it('rejects a DSN that is not a URL', async () => {
    await expect(loadMonitoring('not-a-url')).rejects.toThrow()
  })
})
