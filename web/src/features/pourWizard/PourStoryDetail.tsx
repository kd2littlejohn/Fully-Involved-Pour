import { useState } from 'react'
import type { Bottle, Pour } from '../../data/types'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { ScoreRing } from '../../components/ui/ScoreRing'
import { SpecList, type SpecRow } from '../../components/ui/SpecList'
import { useUserData } from '../../hooks/useUserData'
import { BUY_AGAIN_OPTIONS, FIP_MAX } from '../fip/scoring'
import { fipTier } from '../fip/tiers'
import { PourWizard } from './PourWizard'
import { TastingGradient } from './TastingGradient'
import styles from './PourStoryDetail.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

interface PourStoryDetailProps {
  pour: Pour
  bottle: Bottle
  onClose: () => void
}

export function PourStoryDetail({ pour, bottle, onClose }: PourStoryDetailProps) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { deletePour } = useUserData()

  if (editing) {
    return <PourWizard bottleId={bottle.id} bottleName={bottle.name} existingPour={pour} onClose={onClose} onSaved={onClose} />
  }

  async function handleDelete() {
    setDeleting(true)
    await deletePour(pour.id)
    setDeleting(false)
    onClose()
  }

  const tier = fipTier(pour.rating)
  const buyAgainLabel = BUY_AGAIN_OPTIONS.find((o) => o.value === pour.buyAgain)?.label
  const tastingTags = Array.from(new Set([...pour.fip.noseAromas, ...pour.fip.palateFlavors]))

  const sessionRows: SpecRow[] = []
  if (pour.location) sessionRows.push({ label: 'Location', value: pour.location })
  if (pour.companion) sessionRows.push({ label: 'With', value: pour.companion })
  if (pour.occasion) sessionRows.push({ label: 'Occasion', value: pour.occasion })
  if (pour.glass) sessionRows.push({ label: 'Glass', value: pour.glass })
  if (pour.weather) sessionRows.push({ label: 'Weather', value: pour.weather })
  if (pour.mood) sessionRows.push({ label: 'Mood', value: pour.mood })
  if (typeof pour.ounces === 'number') sessionRows.push({ label: 'Ounces poured', value: pour.ounces })

  const scoreRows: SpecRow[] = [
    { label: 'Nose', value: `${pour.fip.nose.toFixed(1)} / ${FIP_MAX.nose}` },
    { label: 'Palate', value: `${pour.fip.palate.toFixed(1)} / ${FIP_MAX.palate}` },
    { label: 'Finish', value: `${pour.fip.finish.toFixed(1)} / ${FIP_MAX.finish}` },
    { label: 'Complexity & Balance', value: `${pour.fip.complexity.toFixed(1)} / ${FIP_MAX.complexity}` },
    { label: 'Value / Buy Again', value: `${pour.fip.value.toFixed(1)} / ${FIP_MAX.value}${buyAgainLabel ? ` (${buyAgainLabel})` : ''}` },
  ]

  return (
    <Modal title={bottle.name} onClose={onClose}>
      <div className={styles.header}>
        <ScoreRing score={pour.rating} />
        <div className={styles.headerText}>
          <div className={styles.tierLabel}>{tier.label}</div>
          <div className={styles.date}>{dateFormatter.format(new Date(pour.date))}</div>
        </div>
      </div>

      {tastingTags.length > 0 ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Tasting Notes</h3>
          <TastingGradient tags={tastingTags} />
        </div>
      ) : null}

      {sessionRows.length > 0 ? (
        <div className={styles.section}>
          <SpecList rows={sessionRows} />
        </div>
      ) : null}

      <div className={styles.section}>
        <SpecList rows={scoreRows} />
      </div>

      {pour.fip.noseAromas.length > 0 || pour.fip.noseNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Nose</h3>
          {pour.fip.noseAromas.length > 0 ? (
            <div className={styles.chips}>
              {pour.fip.noseAromas.map((a) => (
                <Badge key={a} tone="brass">
                  {a}
                </Badge>
              ))}
            </div>
          ) : null}
          {pour.fip.noseNotes ? <p className={styles.notes}>{pour.fip.noseNotes}</p> : null}
        </div>
      ) : null}

      {pour.fip.palateFlavors.length > 0 || pour.fip.palateNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Palate</h3>
          {pour.fip.palateFlavors.length > 0 ? (
            <div className={styles.chips}>
              {pour.fip.palateFlavors.map((f) => (
                <Badge key={f} tone="brass">
                  {f}
                </Badge>
              ))}
            </div>
          ) : null}
          {pour.fip.palateNotes ? <p className={styles.notes}>{pour.fip.palateNotes}</p> : null}
        </div>
      ) : null}

      {pour.fip.finishNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Finish</h3>
          <p className={styles.notes}>{pour.fip.finishNotes}</p>
        </div>
      ) : null}

      {pour.fip.complexityNotes ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>Complexity & Balance</h3>
          <p className={styles.notes}>{pour.fip.complexityNotes}</p>
        </div>
      ) : null}

      {pour.memory ? (
        <div className={styles.section}>
          <h3 className={styles.heading}>The Memory</h3>
          <p className={styles.memory}>{pour.memory}</p>
        </div>
      ) : null}

      <div className={styles.actions}>
        {confirmingDelete ? (
          <div className={styles.confirm}>
            <span className={styles.confirmText}>Delete this Pour Story?</span>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
