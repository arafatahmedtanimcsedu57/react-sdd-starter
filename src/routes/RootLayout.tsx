import { Outlet } from 'react-router'

// Shared shell around every page — put the header / nav here.
export function RootLayout() {
  return (
    <div className="min-h-dvh">
      <Outlet />
    </div>
  )
}
