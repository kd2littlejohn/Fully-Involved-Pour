import { useState } from 'react'
import type { Bottle, Pour } from '../../../data/types'
import { getCurrentScore, mashBillSummary } from '../../../features/bottleDetails/selectors'
import { bottleJourneyStage } from '../../../features/collection/journeyStage'
import { EmptyState } from '../../../components/ui/EmptyState'
import { controlClassName } from '../../../components/ui/Field'
import styles from './CompareTab.module.css'

interface CompareTabProps {
  bottle: Bottle
  otherBottles: Bottle[]
  pours: Pour[]
}

function formatScore(score: number | undefined): string {
  return typeof score === 'number' ? score.toFixed(1) : '—'
}

export function CompareTab({ bottle, otherBottles, pours }: CompareTabProps) {
  const [otherId, setOtherId] = useState('')

  if (otherBottles.length === 0) {
    return <EmptyState title="Nothing to compare yet." message="Add another bottle to your collection to compare it with this one." />
  }

  const other = otherBottles.find((b) => b.id === otherId)

  const rows: { label: string; a: string; b: string }[] = other
    ? [
        { label: 'FIP Score', a: formatScore(getCurrentScore(bottle, pours)), b: formatScore(getCurrentScore(other, pours)) },
        { label: 'Proof', a: bottle.proof ? String(bottle.proof) : '—', b: other.proof ? String(other.proof) : '—' },
        { label: 'Age', a: bottle.ageStatement ?? '—', b: other.ageStatement ?? '—' },
        { label: 'Price', a: bottle.price ? `$${bottle.price.toFixed(2)}` : '—', b: other.price ? `$${other.price.toFixed(2)}` : '—' },
        { label: 'Distillery', a: bottle.distillery ?? '—', b: other.distillery ?? '—' },
        { label: 'Mash Bill', a: mashBillSummary(bottle) ?? '—', b: mashBillSummary(other) ?? '—' },
        { label: 'Journey Stage', a: bottleJourneyStage(bottle)?.label ?? '—', b: bottleJourneyStage(other)?.label ?? '—' },
      ]
    : []

  return (
    <>
      <div className={styles.picker}>
        <select
          className={controlClassName}
          value={otherId}
          onChange={(e) => setOtherId(e.target.value)}
          aria-label="Compare with"
        >
          <option value="">Choose a bottle to compare…</option>
          {otherBottles.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
              {b.distillery ? ` — ${b.distillery}` : ''}
            </option>
          ))}
        </select>
      </div>

      {other ? (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Spec</th>
              <th scope="col" className={styles.colHeading}>
                {bottle.name}
              </th>
              <th scope="col" className={styles.colHeading}>
                {other.name}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{row.a}</td>
                <td>{row.b}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <EmptyState title="Pick a bottle above." message="Compare FIP score, proof, price, and more side by side." />
      )}
    </>
  )
}
