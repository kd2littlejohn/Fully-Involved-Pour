import { createElement, lazy, Suspense, type ReactNode } from 'react'
import { createHashRouter, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { RouteFallback } from './components/layout/RouteFallback'
import { RouteErrorFallback } from './components/layout/RouteErrorFallback'

const HomePage = lazy(() => import('./pages/Home/HomePage').then((m) => ({ default: m.HomePage })))
const CollectionPage = lazy(() => import('./pages/Collection/CollectionPage').then((m) => ({ default: m.CollectionPage })))
const BottleDetailsPage = lazy(() =>
  import('./pages/BottleDetails/BottleDetailsPage').then((m) => ({ default: m.BottleDetailsPage })),
)
const InfinityBottlesHomePage = lazy(() =>
  import('./pages/InfinityBottle/InfinityBottlesHomePage').then((m) => ({ default: m.InfinityBottlesHomePage })),
)
const BlendBreakdownPage = lazy(() =>
  import('./pages/InfinityBottle/BlendBreakdownPage').then((m) => ({ default: m.BlendBreakdownPage })),
)
const AddToBlendPage = lazy(() =>
  import('./pages/InfinityBottle/AddToBlendPage').then((m) => ({ default: m.AddToBlendPage })),
)
const TastingsPage = lazy(() =>
  import('./pages/InfinityBottle/TastingsPage').then((m) => ({ default: m.TastingsPage })),
)
const LogTastingPage = lazy(() =>
  import('./pages/InfinityBottle/LogTastingPage').then((m) => ({ default: m.LogTastingPage })),
)
const BatchManagementPage = lazy(() =>
  import('./pages/InfinityBottle/BatchManagementPage').then((m) => ({ default: m.BatchManagementPage })),
)
const JournalPage = lazy(() => import('./pages/Journal/JournalPage').then((m) => ({ default: m.JournalPage })))
const AxeHubPage = lazy(() => import('./pages/Axe/AxeHubPage').then((m) => ({ default: m.AxeHubPage })))
const DiscoverPage = lazy(() => import('./pages/Discover/DiscoverPage').then((m) => ({ default: m.DiscoverPage })))
const ProfilePage = lazy(() => import('./pages/Profile/ProfilePage').then((m) => ({ default: m.ProfilePage })))
const EditProfilePage = lazy(() => import('./pages/Profile/EditProfilePage').then((m) => ({ default: m.EditProfilePage })))
const SettingsPage = lazy(() => import('./pages/Settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))
const FriendsPage = lazy(() => import('./pages/Friends/FriendsPage').then((m) => ({ default: m.FriendsPage })))
const FriendProfilePage = lazy(() => import('./pages/Friends/FriendProfilePage').then((m) => ({ default: m.FriendProfilePage })))
const OurWhiskeyStoryPage = lazy(() =>
  import('./pages/Friends/OurWhiskeyStoryPage').then((m) => ({ default: m.OurWhiskeyStoryPage })),
)
const SharedPourStoryPage = lazy(() =>
  import('./pages/Friends/SharedPourStoryPage').then((m) => ({ default: m.SharedPourStoryPage })),
)
const AddFriendPage = lazy(() => import('./pages/Friends/AddFriendPage').then((m) => ({ default: m.AddFriendPage })))
const AddBottlePage = lazy(() => import('./pages/AddBottle/AddBottlePage').then((m) => ({ default: m.AddBottlePage })))
const RarityReviewPage = lazy(() => import('./pages/Collection/RarityReviewPage').then((m) => ({ default: m.RarityReviewPage })))
const BlindRoomLandingPage = lazy(() =>
  import('./pages/BlindRoom/BlindRoomLandingPage').then((m) => ({ default: m.BlindRoomLandingPage })),
)
const CreateBlindPage = lazy(() => import('./pages/BlindRoom/CreateBlindPage').then((m) => ({ default: m.CreateBlindPage })))
const JoinBlindPage = lazy(() => import('./pages/BlindRoom/JoinBlindPage').then((m) => ({ default: m.JoinBlindPage })))
const BlindLobbyPage = lazy(() => import('./pages/BlindRoom/BlindLobbyPage').then((m) => ({ default: m.BlindLobbyPage })))
const BlindTastingPage = lazy(() =>
  import('./pages/BlindRoom/BlindTastingPage').then((m) => ({ default: m.BlindTastingPage })),
)
const BlindRevealPage = lazy(() =>
  import('./pages/BlindRoom/BlindRevealPage').then((m) => ({ default: m.BlindRevealPage })),
)
const PartyHubPage = lazy(() => import('./pages/Party/PartyHubPage').then((m) => ({ default: m.PartyHubPage })))
const PartySetupPage = lazy(() => import('./pages/Party/PartySetupPage').then((m) => ({ default: m.PartySetupPage })))
const JoinPartyPage = lazy(() => import('./pages/Party/JoinPartyPage').then((m) => ({ default: m.JoinPartyPage })))
const GuestPartyPage = lazy(() => import('./pages/Party/GuestPartyPage').then((m) => ({ default: m.GuestPartyPage })))
const HostDashboardPage = lazy(() => import('./pages/Party/HostDashboardPage').then((m) => ({ default: m.HostDashboardPage })))
const PaperBallotsPage = lazy(() => import('./pages/Party/PaperBallotsPage').then((m) => ({ default: m.PaperBallotsPage })))
const PrintScorecardsPage = lazy(() =>
  import('./pages/Party/PrintScorecardsPage').then((m) => ({ default: m.PrintScorecardsPage })),
)
const PartyRecapPage = lazy(() => import('./pages/Party/PartyRecapPage').then((m) => ({ default: m.PartyRecapPage })))
const PartyDisplayPage = lazy(() => import('./pages/Party/PartyDisplayPage').then((m) => ({ default: m.PartyDisplayPage })))

// HashRouter: GitHub Pages (and the second static "Sites" deploy target) have
// no server-side rewrite support, so hash-based routes avoid needing a
// 404.html fallback trick on either target. See plan §Architecture.
//
// Every page is lazy-loaded (see the imports above) — AppShell wraps its
// Outlet in a Suspense boundary (see AppShell.tsx) so only the code for the
// tab you're actually viewing is downloaded, instead of one bundle with
// every page in it.
// Exported separately (not just passed inline to createHashRouter) so tests
// can check path resolution with react-router's matchRoutes() without
// mounting the whole app.
export const routes: Parameters<typeof createHashRouter>[0] = [
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/collection', element: <CollectionPage /> },
      { path: '/collection/rarity-review', element: <RarityReviewPage /> },
      { path: '/collection/:bottleId', element: <BottleDetailsPage /> },
      // Infinity Bottle lives under My Bar — browsable with the bottom nav
      // visible throughout, same as Bottle Details above. :id refers to the
      // vessel (InfinityBottle.id); the current batch is derived from it,
      // not addressed separately in the URL.
      //
      // Wrapped in a pathless layout route so a crash on any of these six
      // pages (e.g. malformed Infinity Bottle data) shows a branded error
      // state in place of just this Outlet slot — AppShell's nav/header
      // stay mounted — instead of React Router's raw stack-trace page.
      {
        errorElement: <RouteErrorFallback backTo="/collection" backLabel="Back to My Bar" />,
        children: [
          { path: '/collection/infinity', element: <InfinityBottlesHomePage /> },
          { path: '/collection/infinity/:id', element: <BlendBreakdownPage /> },
          { path: '/collection/infinity/:id/add', element: <AddToBlendPage /> },
          { path: '/collection/infinity/:id/tastings', element: <TastingsPage /> },
          { path: '/collection/infinity/:id/tastings/new', element: <LogTastingPage /> },
          { path: '/collection/infinity/:id/manage', element: <BatchManagementPage /> },
        ],
      },
      { path: '/journal', element: <JournalPage /> },
      // "Journey" is the current label for this page (see navItems.ts), but
      // /journal stays the canonical URL — it's what's linked throughout the
      // app and what old bookmarks/deep links use. /journey is an alias in
      // case anything external picks up the new name.
      { path: '/journey', element: <Navigate to="/journal" replace /> },
      { path: '/discover', element: <DiscoverPage /> },
      // The AXE Hub: the centre nav destination.
      { path: '/axe', element: <AxeHubPage /> },
      // The old centre tab was "Pour" (a menu, never a page); anything that
      // still links to /pour lands in the Hub with the same Pour menu open.
      { path: '/pour', element: <Navigate to="/axe" replace state={{ openPour: true }} /> },
      { path: '/profile', element: <ProfilePage /> },
      // Browsable like Bottle Details — bottom nav stays visible while
      // looking at Friends or a friend's profile. Reached via Profile ->
      // Friends for this first version (see navItems.ts comment); not a
      // sixth bottom-nav item.
      { path: '/friends', element: <FriendsPage /> },
      { path: '/friends/u/:username', element: <FriendProfilePage /> },
      { path: '/friends/u/:username/story', element: <OurWhiskeyStoryPage /> },
      { path: '/friends/shared/:momentId', element: <SharedPourStoryPage /> },
      // Browsable like Collection/Discover — bottom nav stays visible while
      // deciding which Blind Room to open. Not itself a bottom-nav item; see
      // the "Blind Room" option in Start a Pour and the Journey "Blind
      // History" link for how users actually get here.
      { path: '/blind', element: <BlindRoomLandingPage /> },
      // Blind Room Party Mode hub: Create / Join / Resume / Past parties.
      { path: '/blind/party', element: <PartyHubPage /> },
    ],
  },
  // Outside AppShell — a full-screen add flow shouldn't compete with the
  // persistent bottom nav for the sticky action bar's space. These routes
  // sit outside AppShell's Outlet, so each wraps its own Suspense boundary.
  // Settings and Edit Profile are secondary screens reached from Profile's
  // gear icon / Edit Profile button — same full-screen, no-bottom-nav
  // treatment as Add Bottle and the Blind Room flow below.
  {
    path: '/settings',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <SettingsPage />
      </Suspense>
    ),
  },
  {
    path: '/profile/edit',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <EditProfilePage />
      </Suspense>
    ),
  },
  {
    path: '/friends/add',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <AddFriendPage />
      </Suspense>
    ),
  },
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
  // The Blind Room create/join/lobby flow is a focused, synchronous
  // experience (same reasoning as Add Bottle above) — full-screen, no
  // bottom nav competing for space.
  {
    path: '/blind/new',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <CreateBlindPage />
      </Suspense>
    ),
  },
  {
    path: '/blind/join',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <JoinBlindPage />
      </Suspense>
    ),
  },
  {
    path: '/blind/:roomId/lobby',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <BlindLobbyPage />
      </Suspense>
    ),
  },
  {
    path: '/blind/:roomId/taste',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <BlindTastingPage />
      </Suspense>
    ),
  },
  {
    path: '/blind/:roomId/reveal',
    element: (
      <Suspense fallback={<RouteFallback />}>
        <BlindRevealPage />
      </Suspense>
    ),
  },
  // Blind Room Party Mode — full-screen, no bottom nav: guests usually
  // aren't FIP users, and the host is mid-event. /p/:code is the short
  // link the QR code and invitation share point at.
  ...partyRoute('/p', <JoinPartyPage />),
  ...partyRoute('/p/:code', <JoinPartyPage />),
  ...partyRoute('/party/new', <PartySetupPage />),
  ...partyRoute('/party/:partyId/setup', <PartySetupPage />),
  ...partyRoute('/party/:partyId', <GuestPartyPage />),
  ...partyRoute('/party/:partyId/host', <HostDashboardPage />),
  // Created inline (not a top-level const) so router.tsx doesn't grow another
  // fast-refresh lint warning.
  ...partyRoute('/party/:partyId/cohost', createElement(lazy(() => import('./pages/Party/CoHostAcceptPage').then((m) => ({ default: m.CoHostAcceptPage }))))),
  ...partyRoute('/party/:partyId/ballots', <PaperBallotsPage />),
  ...partyRoute('/party/:partyId/print', <PrintScorecardsPage />),
  ...partyRoute('/party/:partyId/recap', <PartyRecapPage />),
  ...partyRoute('/party/:partyId/display', <PartyDisplayPage />),
  // Scan Barcode Phase 0 proof of concept (docs/BARCODE_POC.md), dev builds
  // only. import.meta.env.DEV folds to false in a production build, so the
  // route, the page and its chunk are dropped — never shipped to the live site.
  ...(import.meta.env.DEV ? [barcodePocRoute()] : []),
]

function partyRoute(path: string, element: ReactNode) {
  return [
    {
      path,
      errorElement: <RouteErrorFallback backTo="/blind/party" backLabel="Back to Party Mode" />,
      element: <Suspense fallback={<RouteFallback />}>{element}</Suspense>,
    },
  ]
}

function barcodePocRoute() {
  return {
    path: '/dev/barcode',
    element: (
      <Suspense fallback={<RouteFallback />}>
        {createElement(lazy(() => import('./pages/Dev/BarcodePocPage').then((m) => ({ default: m.BarcodePocPage }))))}
      </Suspense>
    ),
  }
}

// The temporary barcode preview channel (.github/workflows/
// barcode-preview.yml) serves ONLY the scanner page: every other path
// redirects to it, so nothing in that build can open My Bar, Add Bottle or
// any other screen that edits real data. __FIP_BARCODE_POC__ is the literal
// false in a production build, so this is dropped there.
export const router = createHashRouter(
  __FIP_BARCODE_POC__ ? [barcodePocRoute(), { path: '*', element: <Navigate to="/dev/barcode" replace /> }] : routes,
)
