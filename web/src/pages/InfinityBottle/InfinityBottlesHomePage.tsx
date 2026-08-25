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
import { OverflowMenu } from '../../components/ui/OverflowMenu'
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
  const { userDoc, createInfinityBottle, archiveInfinityBottle, deleteInfinityBottle } = useUserData()
  const [tab, setTab] = useState<'active' | 'archived'>('active')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [capacityMl, setCapacityMl] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<InfinityBottle | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  // Every Infinity Bottle in userDoc.infinityBottles is independent — the
  // Active/Archived tabs are just a filter over the full list, never a
  // "pick one" selection. No card here is treated as more "primary" than
  // any other; each one gets identical layout and identical actions.
  const active = userDoc.infinityBottles.filter((ib) => !ib.archived)
  const archivedList = userDoc.infinityBottles.filter((ib) => ib.archived)
  const visible = tab === 'active' ? active : archivedList

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

  async function handleUnarchive(ib: InfinityBottle) {
    await archiveInfinityBottle(ib.id, false)
  }

  async function handleConfirmDelete() {
    if (!deleteTarget || deleting) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteInfinityBottle(deleteTarget.id)
      setDeleteTarget(null)
    } catch {
      setDeleteError('Could not delete this Infinity Bottle. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  function renderCard(ib: InfinityBottle) {
    const batch = displayBatch(ib)
    if (!batch) return null
    const volumeMl = batchVolumeMl(batch)
    const proof = estimatedProof(batch)
    const score = currentScore(batch)
    const sourceCount = batchComposition(batch).length
    const displayName = batchDisplayName(ib, batch)
    const fillPercent = ib.capacityMl ? Math.min(100, Math.round((volumeMl / ib.capacityMl) * 100)) : undefined

    return (
      <div className={styles.card} key={ib.id}>
        <div className={styles.photoWrap}>
          {ib.photoUrl ? <img className={styles.photo} src={ib.photoUrl} alt="" /> : <div className={styles.photoPlaceholder} />}
        </div>
        <div className={styles.cardBody}>
          <div className={styles.cardHeaderRow}>
            <h2 className={styles.cardName}>{displayName}</h2>
            {ib.archived ? (
              <OverflowMenu
                label={`${displayName} actions`}
                items={[
                  { label: 'View History', onClick: () => navigate(`/collection/infinity/${ib.id}`) },
                  { label: 'Unarchive', onClick: () => void handleUnarchive(ib) },
                  { label: 'Delete', tone: 'danger', onClick: () => setDeleteTarget(ib) },
                ]}
              />
            ) : (
              <OverflowMenu
                label={`${displayName} actions`}
                items={[{ label: 'Manage', onClick: () => navigate(`/collection/infinity/${ib.id}/manage`) }]}
              />
            )}
          </div>
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

          {fillPercent != null ? (
            <div className={styles.fillRow}>
              <div className={styles.fillTrack}>
                <div className={styles.fillBar} style={{ width: `${fillPercent}%` }} />
              </div>
              <span className={styles.fillLabel}>{fillPercent}% full</span>
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
    <div className={styles.page}>
      <InfinityBottleHeader backTo="/collection" title="Infinity Bottles" />

      <div className={styles.body}>
        <Button className={styles.newButton} onClick={() => setCreating(true)}>
          + New Infinity Bottle
        </Button>

        <Tabs
          tabs={[
            { id: 'active', label: 'Active' },
            { id: 'archived', label: 'Archived' },
          ]}
          active={tab}
          onChange={(id) => setTab(id as 'active' | 'archived')}
        />

        <TabPanel>
          {visible.length > 0 ? (
            <div className={styles.cardList}>{visible.map((ib) => renderCard(ib))}</div>
          ) : tab === 'active' ? (
            userDoc.infinityBottles.length === 0 ? (
              <EmptyState
                title="Create Your First Infinity Bottle."
                message="Build a blend over time from bottles you already own."
                action={<Button onClick={() => setCreating(true)}>Create Infinity Bottle</Button>}
              />
            ) : (
              <EmptyState
                title="No active Infinity Bottles."
                message="Every Infinity Bottle you have is archived right now."
                action={<Button onClick={() => setCreating(true)}>Create New Infinity Bottle</Button>}
              />
            )
          ) : (
            <EmptyState title="No archived Infinity Bottles." message="Archived Infinity Bottles will show up here." />
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

      {deleteTarget ? (
        <Modal title="Delete this Infinity Bottle?" onClose={() => (deleting ? null : setDeleteTarget(null))}>
          <p className={styles.confirmText}>
            This removes the blend, every batch, tasting, and photo, and cannot be undone. Your source bottles in My Bar are not
            affected.
          </p>
          {deleteError ? (
            <p className={styles.error} role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void handleConfirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete Infinity Bottle'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
