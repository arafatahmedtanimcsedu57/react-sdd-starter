import { createBrowserRouter, RouterProvider } from 'react-router'
import { routes } from './routes/routes'

const router = createBrowserRouter(routes)

// App shell: the router. Pages and the error / loading screens live in src/routes/.
export function App() {
  return <RouterProvider router={router} />
}
