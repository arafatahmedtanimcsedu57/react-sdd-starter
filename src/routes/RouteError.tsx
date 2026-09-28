import { useEffect } from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { reportError } from '../lib/monitoring'

// The app's error boundary: unknown URLs and any error thrown while rendering a page.
export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404

  useEffect(() => {
    // 4xx responses are expected (not found, signed out); report crashes and server errors.
    if (!isRouteErrorResponse(error)) void reportError(error)
    else if (error.status >= 500) void reportError(new Error(`${error.status} ${error.statusText}`))
  }, [error])

  return (
    <main className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold">
        {notFound ? 'Page not found' : 'Something went wrong'}
      </h1>
      <p className="my-4">
        {notFound
          ? 'The page you asked for does not exist.'
          : 'An unexpected error happened. Try reloading the page.'}
      </p>
      <Link to="/" reloadDocument className="underline">
        Go to the home page
      </Link>
    </main>
  )
}
