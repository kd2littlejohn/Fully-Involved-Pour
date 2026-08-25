import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InfinityBottleHeader } from '../../features/infinityBottle/InfinityBottleHeader'
import {
  batchComposition,
  batchDisplayName,
  batchVolumeMl,
  currentScore,
  displayBatch,
  estimatedProof,
} from '../../features/infinityBottle/selectors'
import { Tabs, TabPanel } from '../../components/ui/Tabs'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { Field, controlClassName } from '../../components/ui/Field'
import { fipTier } from '../../features/fip/tiers'
import { useUserData } from '../../hooks/useUserData'
import type { InfinityBottle } from '../../data/types'
import styles from './InfinityBottlesHomePage.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function lastAdditionDate(ib: InfinityBottle): string | undefined {
  const batch = displayBatch(ib)
  if (!batch || batch.additions.length === 0) return undefined
  return [...batch.additions].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
}

function lastTastingDate(ib: InfinityBottle): string | undefined {
  const batch = displayBatch(ib)
  if (!batch || batch.tastings.length === 0) return undefined
  return [...batch.tastings].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
}

export function InfinityBottlesHomePage() {
  const navigate = useNavigate()
  const { userDoc, createInfinityBottle } = useUserData()
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [capacityMl, setCapacityMl] = useState('')
  const [saving, setSaving] = useState(false)

  const active = userDoc.infinityBottles.filter((ib) => !ib.archived)
  const archived = userDoc.infinityBottles.filter((ib) => ib.archived)
  const featured = tab === 'active' ? active[0] : undefined
  const others = tab === 'active' ? active.slice(1) : archived

  async function handleCreate() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      const id = await createInfinityBottle({ name: name.trim(), capacityMl: capacityMl ? Number(capacityMl) : undefined })
      setCreating(false)
      setName('')
      setCapacityMl('')
      if (id) navigate(`/collection/infinity/${id}`)
    } finally {
      setSaving(false)
    }
  }

  function renderCard(ib: InfinityBottle, isFeatured: boolean) {
    const batch = displayBatch(ib)
    if (!batch) return null
    const volumeMl = batchVolumeMl(batch)
    const proof = estimatedProof(batch)
    const score = currentScore(batch)
    const sourceCount = batchComposition(batch).length
    const displayName = batchDisplayName(ib, batch)

    if (isFeatured) {
      return (
        <div className={styles.featuredCard} key={ib.id}>
          <div className={styles.photoWrap}>
            {ib.photoUrl ? <img className={styles.photo} src={ib.photoUrl} alt="" /> : <div className={styles.photoPlaceholder} />}
          </div>
          <div className={styles.featuredBody}>
            <h2 className={styles.featuredName}>{displayName}</h2>
            <span className={batch.status === 'active' ? styles.statusActive : styles.statusComplete}>
              {batch.status === 'active' ? 'Current Batch' : 'Batch Complete'}
            </span>

            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={styles.statValue}>
                  {volumeMl}ml{ib.capacityMl ? ` / ${ib.capacityMl}ml` : ''}
                </div>
                <div className={styles.statLabel}>Total Volume{ib.capacityMl ? ' / Capacity' : ''}</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statValue}>{proof != null ? proof.toFixed(1) : 'Unavailable'}</div>
                <div className={styles.statLabel}>Est. Proof</div>
              </div>
            </div>

            {ib.capacityMl ? (
              <div className={styles.fillTrack}>
                <div className={styles.fillBar} style={{ width: `${Math.min(100, (volumeMl / ib.capacityMl) * 100)}%` }} />
              </div>
            ) : null}

            <div className={styles.metaRow}>
              {score != null ? (
                <span className={styles.metaItem} style={{ color: fipTier(score).color }}>
                  {score.toFixed(1)} ★
                </span>
              ) : null}
              <span className={styles.metaItem}>{sourceCount} source bottles</span>
            </div>
            <div className={styles.metaRow}>
              {lastAdditionDate(ib) ? <span className={styles.metaItem}>Last addition {dateFormatter.format(new Date(lastAdditionDate(ib)!))}</span> : null}
              {lastTastingDate(ib) ? <span className={styles.metaItem}>Last tasting {dateFormatter.format(new Date(lastTastingDate(ib)!))}</span> : null}
            </div>

            <div className={styles.actions}>
              <Button onClick={() => navigate(`/collection/infinity/${ib.id}/add`)}>Add to Blend</Button>
              <Button variant="secondary" onClick={() => navigate(`/collection/infinity/${ib.id}/tastings/new`)}>
                Log a Tasting
              </Button>
              <Button variant="ghost" onClick={() => navigate(`/collection/infinity/${ib.id}`)}>
                View Blend
              </Button>
            </div>
          </div>
        </div>
      )
    }

    return (
      <button type="button" className={styles.otherCard} key={ib.id} onClick={() => navigate(`/collection/infinity/${ib.id}`)}>
        <div className={styles.otherPhotoWrap}>
          {ib.photoUrl ? <img className={styles.otherPhoto} src={ib.photoUrl} alt="" /> : <div className={styles.photoPlaceholder} />}
        </div>
        <div className={styles.otherName}>{displayName}</div>
        <div className={batch.status === 'active' ? styles.statusActiveSmall : styles.statusCompleteSmall}>
          {batch.status === 'active' ? 'Current Batch' : 'Batch Complete'}
        </div>
      </button>
    )
  }

  return (
    <div className={styles.page}>
      <InfinityBottleHeader backTo="/collection" title="Infinity Bottles" />

      <div className={styles.body}>
        <Tabs
          tabs={[
            { id: 'active', label: 'Active' },
            { id: 'archived', label: 'Archived' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'active' | 'archived')}
        />

        <TabPanel>
          {tab === 'active' && !featured ? (
            <EmptyState
              title="Create Your Infinity Bottle"
              message="Build a blend over time from bottles you already own."
              action={<Button onClick={() => setCreating(true)}>Create Infinity Bottle</Button>}
            />
          ) : (
            <>
              {featured ? renderCard(featured, true) : null}

              {others.length > 0 ? (
                <div className={styles.otherSection}>
                  <h3 className={styles.otherHeading}>{tab === 'active' ? 'Other Infinity Bottles' : 'Archived'}</h3>
                  <div className={styles.otherGrid}>{others.map((ib) => renderCard(ib, false))}</div>
                </div>
              ) : null}

              {tab === 'active' ? (
                <Button variant="ghost" onClick={() => setCreating(true)}>
                  + Start Another Infinity Bottle
                </Button>
              ) : null}
            </>
          )}
        </TabPanel>
      </div>

      {creating ? (
        <Modal title="Create Infinity Bottle" onClose={() => (saving ? null : setCreating(false))}>
          <Field label="Name" htmlFor="ib-name" required>
            <input
              id="ib-name"
              className={controlClassName}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Backdraft Batch"
            />
          </Field>
          <Field label="Capacity (ml, optional)" htmlFor="ib-capacity">
            <input
              id="ib-capacity"
              type="number"
              inputMode="numeric"
              className={controlClassName}
              value={capacityMl}
              onChange={(e) => setCapacityMl(e.target.value)}
              placeholder="1000"
            />
          </Field>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => void handleCreate()} disabled={!name.trim() || saving}>
              {saving ? 'Creating…' : 'Create Infinity Bottle'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
