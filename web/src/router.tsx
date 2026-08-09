import { createHashRouter } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { HomePage } from './pages/Home/HomePage'
import { CollectionPage } from './pages/Collection/CollectionPage'
import { BottleDetailsPage } from './pages/BottleDetails/BottleDetailsPage'
import { JournalPage } from './pages/Journal/JournalPage'
import { DiscoverPage } from './pages/Discover/DiscoverPage'
import { ProfilePage } from './pages/Profile/ProfilePage'
import { AddBottlePage } from './pages/AddBottle/AddBottlePage'

// HashRouter: GitHub Pages (and the second static "Sites" deploy target) have
// no server-side rewrite support, so hash-based routes avoid needing a
// 404.html fallback trick on either target. See plan §Architecture.
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
  // persistent bottom nav for the sticky action bar's space.
  { path: '/bottles/new', element: <AddBottlePage /> },
  { path: '/bottles/:bottleId/edit', element: <AddBottlePage /> },
])
