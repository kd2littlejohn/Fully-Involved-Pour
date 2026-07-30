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
import type { Bottle } from '../../data/types'
import styles from './CollectionPage.module.css'

type Filter = 'all' | 'open' | 'sealed' | 'wishlist' | 'favorites'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Opened' },
  { value: 'sealed', label: 'Sealed' },
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'favorites', label: 'Favorites' },
]

function matchesFilter(bottle: Bottle, filter: Filter): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'favorites':
      return Boolean(bottle.favorite)
    default:
      return bottle.status === filter
  }
}

export function CollectionPage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, addBottle } = useUserData()
  const [filter, setFilter] = useState<Filter>('all')
  const [showAddForm, setShowAddForm] = useState(false)

  const filteredBottles = useMemo(
    () => userDoc.bottles.filter((bottle) => matchesFilter(bottle, filter)),
    [userDoc.bottles, filter],
  )

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
                  {option.label} ({userDoc.bottles.filter((b) => matchesFilter(b, option.value)).length})
                </button>
              ))}
            </div>
            <Button onClick={() => setShowAddForm(true)}>Add a Bottle</Button>
          </div>

          {filteredBottles.length === 0 ? (
            <EmptyState title="No bottles here yet." message="Try a different filter, or add a bottle to this view." />
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
