import { useEffect, useRef, useState } from 'react'
import { Button } from '../ui/Button'
import { initPwaUpdate, type PwaUpdateController } from '../../pwaUpdate'
import styles from './UpdateAvailableBanner.module.css'

export function UpdateAvailableBanner() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const controllerRef = useRef<PwaUpdateController | null>(null)

  useEffect(() => {
    const controller = initPwaUpdate(() => setNeedRefresh(true))
    controllerRef.current = controller
    return () => {
      controller.teardown()
      controllerRef.current = null
    }
  }, [])

  if (!needRefresh || dismissed) return null

  function handleRefresh() {
    if (refreshing) return
    setRefreshing(true)
    void controllerRef.current?.refresh()
  }

  return (
    <div className={styles.banner} role="status">
      <span className={styles.message}>An update is ready.</span>
      <div className={styles.actions}>
        <Button variant="ghost" onClick={() => setDismissed(true)} disabled={refreshing}>
          Later
        </Button>
        <Button variant="secondary" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh Now'}
        </Button>
      </div>
    </div>
  )
}
