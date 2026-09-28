import { env } from './env'

// Production error tracking. Off unless VITE_SENTRY_DSN is set, and the SDK is loaded with a
// dynamic import so it never lands in the main chunk. Uncaught errors and unhandled
// rejections are captured automatically once it starts; errors the app catches itself (the
// route error boundary, React's root handlers) go through reportError.

type Sentry = typeof import('@sentry/react')

// One shared load + init, so an error reported early waits for init instead of being dropped.
let sentry: Promise<Sentry> | undefined

function loadSentry(dsn: string): Promise<Sentry> {
  sentry ??= import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      integrations: [Sentry.browserTracingIntegration()],
      tracesSampleRate: env.VITE_SENTRY_TRACES_SAMPLE_RATE,
    })
    return Sentry
  })
  return sentry
}

export async function initMonitoring(): Promise<void> {
  if (!env.VITE_SENTRY_DSN) return
  await loadSentry(env.VITE_SENTRY_DSN)
}

export async function reportError(error: unknown): Promise<void> {
  console.error(error)
  if (!env.VITE_SENTRY_DSN) return
  try {
    const Sentry = await loadSentry(env.VITE_SENTRY_DSN)
    Sentry.captureException(error)
  } catch (loadError) {
    console.error('Could not report the error above to Sentry', loadError)
  }
}
