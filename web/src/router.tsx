import { lazy, Suspense } from 'react'
import { createHashRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RouteFallback } from './components/layout/RouteFallback'

const HomePage = lazy(() => import('./pages/Home/HomePage').then((m) => ({ default: m.HomePage })))
const CollectionPage = lazy(() => import('./pages/Collection/CollectionPage').then((m) => ({ default: m.CollectionPage })))
const BottleDetailsPage = lazy(() =>
  import('./pages/BottleDetails/BottleDetailsPage').then((m) => ({ default: m.BottleDetailsPage })),
)
const JournalPage = lazy(() => import('./pages/Journal/JournalPage').then((m) => ({ default: m.JournalPage })))
const DiscoverPage = lazy(() => import('./pages/Discover/DiscoverPage').then((m) => ({ default: m.DiscoverPage })))
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const AddBottlePage = lazy(() => import('./pages/AddBottle/AddBottlePage').then((m) => ({ default: m.AddBottlePage })))

// HashRouter: GitHub Pages (and the second static "Sites" deploy target) have
// no server-side rewrite support, so hash-based routes avoid needing a
// 404.html fallback trick on either target. See plan §Architecture.
//
// Every page is lazy-loaded (see the imports above) — AppShell wraps its
// Outlet in a Suspense boundary (see AppShell.tsx) so only the code for the
// tab you're actually viewing is downloaded, instead of one bundle with
// every page in it.
export const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/collection', element: <CollectionPage /> },
      { path: '/collection/:bottleId', element: <BottleDetailsPage /> },
      { path: '/journal', element: <JournalPage /> },
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/profile', element: <ProfilePage /> },
    ],
  },
  // Outside AppShell — a full-screen add flow shouldn't compete with the
  // persistent bottom nav for the sticky action bar's space. These routes
  // sit outside AppShell's Outlet, so each wraps its own Suspense boundary.
  {
    path: '/bottles/new',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <AddBottlePage />
      </Suspense>
    ),
  },
  {
    path: '/bottles/:bottleId/edit',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <AddBottlePage />
      </Suspense>
    ),
  },
])
