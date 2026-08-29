import { useState } from 'react'
import type { Bottle, BottleInstance, Pour } from '../../data/types'
import { instanceLabel, openInstances } from '../../features/bottleInstances/selectors'
import { parseLocalDate } from '../../features/bottleDetails/selectors'
import { useUserData } from '../../hooks/useUserData'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, controlClassName } from '../../components/ui/Field'
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu'
import styles from './YourBottlesSection.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function formatDate(date: string): string {
  return dateFormatter.format(parseLocalDate(date))
}

function instanceMetaLines(instance: BottleInstance): string[] {
  const lines: string[] = []
  const purchaseParts = [
    instance.purchaseDate ? `Purchased ${formatDate(instance.purchaseDate)}` : null,
    instance.price != null ? `$${instance.price.toFixed(2)}` : null,
    instance.storeLocation,
  ].filter(Boolean)
  if (purchaseParts.length > 0) lines.push(purchaseParts.join(' · '))
  if (instance.openedDate) lines.push(`Opened ${formatDate(instance.openedDate)}`)
  if (instance.finishedDate) lines.push(`Finished ${formatDate(instance.finishedDate)}`)
  return lines
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

interface YourBottlesSectionProps {
  bottle: Bottle
  pours: Pour[]
}

// Only ever rendered when this expression has more than one physical
// bottle — see OverviewTab. Each instance is authoritative for its own
// status/purchase/dates from here on; nothing here ever writes to the
// bottle's top-level rollup fields directly (the mutators recompute those).
export function YourBottlesSection({ bottle, pours }: YourBottlesSectionProps) {
  const { updateBottleInstance, deleteBottleInstance, openBottleInstance, openNextBottleInstance } = useUserData()
  const instances = bottle.instances ?? []
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmOpenAnother, setConfirmOpenAnother] = useState<BottleInstance | null>(null)
  const [finishPrompt, setFinishPrompt] = useState<{ sealedCount: number } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<BottleInstance | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  if (instances.length === 0) return null

  function hasHistory(instance: BottleInstance): boolean {
    return Boolean(instance.openedDate || instance.finishedDate) || pours.some((p) => p.bottleInstanceId === instance.id)
  }

  function toggleExpanded(instance: BottleInstance) {
    if (expandedId === instance.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(instance.id)
    setEditLabel(instance.label ?? '')
  }

  async function handleSaveLabel(instance: BottleInstance) {
    setSaving(true)
    try {
      await updateBottleInstance(bottle.id, instance.id, { label: editLabel.trim() || undefined })
    } finally {
      setSaving(false)
    }
  }

  async function handleOpen(instance: BottleInstance) {
    if (openInstances(instances).length > 0) {
      setConfirmOpenAnother(instance)
      return
    }
    await openBottleInstance(bottle.id, instance.id)
  }

  async function confirmOpenAnyway() {
    if (!confirmOpenAnother) return
    await openBottleInstance(bottle.id, confirmOpenAnother.id)
    setConfirmOpenAnother(null)
  }

  // Finishing and opening the replacement are two distinct, separate
  // actions — this only offers the next step, never performs it
  // automatically.
  async function handleFinish(instance: BottleInstance) {
    const sealedCount = instances.filter((i) => i.id !== instance.id && i.status === 'sealed').length
    await updateBottleInstance(bottle.id, instance.id, { status: 'finished', finishedDate: instance.finishedDate ?? todayIsoDate() })
    if (sealedCount > 0) setFinishPrompt({ sealedCount })
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteBottleInstance(bottle.id, deleteTarget.id)
      setDeleteTarget(null)
      setExpandedId(null)
    } catch {
      setDeleteError('Could not delete this bottle. Try again.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className={styles.section}>
      <h3 className={styles.heading}>Your Bottles</h3>
      <div className={styles.list}>
        {instances.map((instance, index) => {
          const label = instanceLabel(instance, index)
          const expanded = expandedId === instance.id
          const meta = instanceMetaLines(instance)

          const menuItems: OverflowMenuItem[] = []
          if (instance.status === 'sealed') menuItems.push({ label: 'Open This Bottle', onClick: () => void handleOpen(instance) })
          if (instance.status === 'open') menuItems.push({ label: 'Mark Finished', onClick: () => void handleFinish(instance) })
          if (instances.length > 1) {
            menuItems.push({ label: 'Delete', tone: 'danger', onClick: () => setDeleteTarget(instance) })
          }

          return (
            <div className={styles.row} key={instance.id}>
              <button type="button" className={styles.rowHeader} onClick={() => toggleExpanded(instance)} aria-expanded={expanded}>
                <span className={styles.rowTitle}>{label}</span>
                <Badge tone={instance.status === 'open' ? 'amber' : 'default'}>
                  {instance.status === 'open' ? 'Open' : instance.status === 'finished' ? 'Finished' : 'Sealed'}
                </Badge>
              </button>
              {meta.map((line) => (
                <p className={styles.meta} key={line}>
                  {line}
                </p>
              ))}

              {expanded ? (
                <div className={styles.body}>
                  <Field label="Nickname (optional)" htmlFor={`your-bottle-${instance.id}-label`}>
                    <input
                      id={`your-bottle-${instance.id}-label`}
                      className={controlClassName}
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Total Wine pick, Batch 24…"
                    />
                  </Field>
                  <Button variant="secondary" onClick={() => void handleSaveLabel(instance)} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Nickname'}
                  </Button>
                </div>
              ) : null}

              {menuItems.length > 0 ? (
                <div className={styles.rowActions}>
                  <OverflowMenu items={menuItems} label={`${label} actions`} />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {confirmOpenAnother ? (
        <Modal title="Open another bottle?" onClose={() => setConfirmOpenAnother(null)}>
          <p className={styles.confirmText}>
            You already have an open bottle of this expression. Open {instanceLabel(confirmOpenAnother, instances.indexOf(confirmOpenAnother))} anyway?
          </p>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setConfirmOpenAnother(null)}>
              Cancel
            </Button>
            <Button onClick={() => void confirmOpenAnyway()}>Open Anyway</Button>
          </div>
        </Modal>
      ) : null}

      {finishPrompt ? (
        <Modal title="Open another bottle?" onClose={() => setFinishPrompt(null)}>
          <p className={styles.confirmText}>
            You have {finishPrompt.sealedCount} sealed {bottle.name} bottle{finishPrompt.sealedCount === 1 ? '' : 's'} remaining. Open
            another {bottle.name}?
          </p>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setFinishPrompt(null)}>
              Not Yet
            </Button>
            <Button
              onClick={async () => {
                await openNextBottleInstance(bottle.id)
                setFinishPrompt(null)
              }}
            >
              Open Next Bottle
            </Button>
          </div>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title={`Delete ${instanceLabel(deleteTarget, instances.indexOf(deleteTarget))}?`} onClose={() => (deleting ? null : setDeleteTarget(null))}>
          <p className={styles.confirmText}>
            {hasHistory(deleteTarget)
              ? 'This bottle has pours or history recorded against it. Deleting it removes that history and cannot be undone.'
              : 'This removes this bottle and cannot be undone.'}
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
              {deleting ? 'Deleting…' : 'Delete Bottle'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  )
}
