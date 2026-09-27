import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Provider } from 'react-redux'
import { store } from './store'
import { App } from './App'
import './styles/index.css'

async function enableMocking() {
  if (import.meta.env.VITE_API_MOCKING !== 'enabled') return
  const { worker } = await import('./mocks/browser')
  return worker.start({ onUnhandledRequest: 'bypass' })
}

// Render even if the mock worker fails to start, so a mocking problem shows up as failed
// requests in the console instead of a blank page.
enableMocking()
  .catch((error) => console.error('MSW failed to start', error))
  .then(() => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <Provider store={store}>
          <App />
        </Provider>
      </StrictMode>,
    )
  })
