import { useMemo, useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { BottleCard } from '../../components/domain/BottleCard'
import { AddBottleForm } from '../../components/domain/AddBottleForm'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { getCoreBarBottles } from '../../features/coreBar/selectors'
import { InfinityBottleButton } from '../../features/infinityBottle/InfinityBottleButton'
import type { Bottle } from '../../data/types'
import styles from './CollectionPage.module.css'

type Filter = 'all' | 'open' | 'sealed' | 'wishlist' | 'favorites' | 'core-bar'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Opened' },
  { value: 'sealed', label: 'Sealed' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'favorites', label: 'Favorites' },
  { value: 'core-bar', label: 'Core Bar' },
]

function matchesFilter(bottle: Bottle, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'favorites':
      return Boolean(bottle.favorite)
    case 'core-bar':
      return false // Core Bar is computed from pours, handled separately below.
    default:
      return bottle.status === filter
  }
}

export function CollectionPage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, addBottle } = useUserData()
  const [filter, setFilter] = useState<Filter>('all')
  const [showAddForm, setShowAddForm] = useState(false)

  const coreBarBottles = useMemo(() => getCoreBarBottles(userDoc.bottles, userDoc.pours), [userDoc.bottles, userDoc.pours])

  const filteredBottles = useMemo(() => {
    if (filter === 'core-bar') return coreBarBottles
    return userDoc.bottles.filter((bottle) => matchesFilter(bottle, filter))
  }, [userDoc.bottles, filter, coreBarBottles])

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Collection" title="Your bottles." />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Collection" title="Your bottles." subtitle="Manage and explore the bottles you own." />
        <EmptyState
          title="Your whiskey journey starts here."
          message="Sign in to start building your collection."
          action={<SignInButton />}
        />
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="Collection" title="Your bottles." subtitle="Manage and explore the bottles you own." />

      {userDoc.bottles.length === 0 ? (
        <EmptyState
          title="Your whiskey journey starts here."
          message="Add a bottle to begin building your collection."
          action={<Button onClick={() => setShowAddForm(true)}>Add a Bottle</Button>}
        />
      ) : (
        <>
          <div className={styles.toolbar}>
            <div className={styles.chips}>
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={option.value === filter ? `${styles.chip} ${styles.chipActive}` : styles.chip}
                  onClick={() => setFilter(option.value)}
                  aria-pressed={option.value === filter}
                >
                  {option.label} ({option.value === 'core-bar' ? coreBarBottles.length : userDoc.bottles.filter((b) => matchesFilter(b, option.value)).length})
                </button>
              ))}
            </div>
            <div className={styles.toolbarActions}>
              <InfinityBottleButton />
              <Button onClick={() => setShowAddForm(true)}>Add a Bottle</Button>
            </div>
          </div>

          {filteredBottles.length === 0 ? (
            <EmptyState
              title={filter === 'core-bar' ? 'No Core Bar bottles yet.' : 'No bottles here yet.'}
              message={
                filter === 'core-bar'
                  ? 'Log a few Pour Stories for a bottle to see it earn a permanent spot here.'
                  : 'Try a different filter, or add a bottle to this view.'
              }
            />
          ) : (
            <div className={styles.grid}>
              {filteredBottles.map((bottle) => (
                <BottleCard key={bottle.id} bottle={bottle} />
              ))}
            </div>
          )}
        </>
      )}

      {showAddForm ? (
        <Modal title="Add a Bottle" onClose={() => setShowAddForm(false)}>
          <AddBottleForm
            onCancel={() => setShowAddForm(false)}
            onSubmit={async (input) => {
              await addBottle(input)
              setShowAddForm(false)
            }}
          />
        </Modal>
      ) : null}
    </>
  )
}
