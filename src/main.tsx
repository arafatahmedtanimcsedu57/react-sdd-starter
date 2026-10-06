import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import { App } from './App'
import { env } from './lib/env'
import { initMonitoring, reportError } from './lib/monitoring'
import './styles/index.css'

async function enableMocking() {
  if (env.VITE_API_MOCKING !== 'enabled') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledFrame: 'bypass' })
}

// Monitoring starts in parallel and never blocks the first render.
void initMonitoring().catch((error) => console.error('Monitoring failed to start', error))

// Render even if the mock worker fails to start, so a mocking problem shows up as failed
// requests in the console instead of a blank page.
enableMocking()
  .catch((error) => console.error('MSW failed to start', error))
  .then(() => {
    // Errors inside routes are reported by RouteError (the router's error boundary); this
    // catches the rest, e.g. a crash in a provider above the router.
    createRoot(document.getElementById('root')!, {
      onUncaughtError: (error) => void reportError(error),
    }).render(
      <StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </StrictMode>,
    )
  })
