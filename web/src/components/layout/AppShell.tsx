import { Suspense } from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from './TopNav'
import { MobileTopBar } from './MobileTopBar'
import { BottomNav } from './BottomNav'
import { DevModeBadge } from './DevModeBadge'
import { RouteFallback } from './RouteFallback'
import { AxeLauncher } from '../../features/sommelier/AxeLauncher'
import styles from './AppShell.module.css'

export function AppShell() {
  return (
    <div className={styles.shell}>
      <DevModeBadge />
      <TopNav />
      <MobileTopBar />
      <main className={styles.main}>
        <Suspense fallback={<RouteFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <BottomNav />
      {/* AXE lives in the centre nav tab; nothing floats over content. */}
      <AxeLauncher floating={false} />
    </div>
  )
}
