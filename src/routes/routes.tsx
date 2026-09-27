import type { RouteObject } from 'react-router'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'
import { RouteLoading } from './RouteLoading'

// Every page in the app. Add a page: create src/routes/<Name>Page.tsx and add a child here.
// Pages are lazy-loaded so each one becomes its own chunk and the first load stays small.
// The root errorElement catches render errors in any page and unknown URLs (404).
export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RouteError />,
    HydrateFallback: RouteLoading,
    children: [
      {
        index: true,
        lazy: async () => ({ Component: (await import('./ItemsPage')).ItemsPage }),
      },
    ],
  },
]
