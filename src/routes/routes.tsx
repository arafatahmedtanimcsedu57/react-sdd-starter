import type { RouteObject } from 'react-router'
import { RootLayout } from './RootLayout'
import { RouteError } from './RouteError'
import { RouteLoading } from './RouteLoading'

// Every page in the app, collected from src/routes/*.route.tsx (each exports `route`). Add
// a page: create <Name>Page.tsx and <name>.route.tsx next to it — never edit this file.
// Only the small route objects load eagerly; pages are lazy chunks. React Router ranks
// routes by path, so file order doesn't matter. The root errorElement catches render
// errors in any page and unknown URLs (404).
const files = import.meta.glob<{ route: RouteObject }>('./*.route.tsx', { eager: true })

export const pageRoutes: RouteObject[] = Object.values(files).map((file) => file.route)

export const routes: RouteObject[] = [
  {
    path: '/',
    Component: RootLayout,
    errorElement: <RouteError />,
    HydrateFallback: RouteLoading,
    children: pageRoutes,
  },
]
