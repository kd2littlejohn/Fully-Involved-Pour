import { useState } from 'react'
import type { Bottle, Pour } from '../../../data/types'
import { getCurrentScore, getPoursForBottle, mashBillSummary } from '../../../features/bottleDetails/selectors'
import { bottleJourneyStage } from '../../../features/collection/journeyStage'
import { EmptyState } from '../../../components/ui/EmptyState'
import { controlClassName } from '../../../components/ui/Field'
import { Button } from '../../../components/ui/Button'
import { RadarChart } from '../../../components/ui/RadarChart'
import { BottlePlaceholder } from '../../../components/ui/BottlePlaceholder'
import { FIP_MAX } from '../../../features/fip/scoring'
import { castFaceoffVote } from '../../../features/faceoff/repository'
import { useAuth } from '../../../hooks/useAuth'
import styles from './CompareTab.module.css'

interface CompareTabProps {
  bottle: Bottle
  otherBottles: Bottle[]
  pours: Pour[]
}

const RADAR_AXES = ['Nose', 'Palate', 'Finish', 'Complexity', 'Value']
const RADAR_MAXES = [FIP_MAX.nose, FIP_MAX.palate, FIP_MAX.finish, FIP_MAX.complexity, FIP_MAX.value]

function formatScore(score: number | undefined): string {
  return typeof score === 'number' ? score.toFixed(1) : '—'
}

function radarValues(bottle: Bottle, pours: Pour[]): number[] | undefined {
  const latest = getPoursForBottle(pours, bottle.id)[0]
  if (!latest) return undefined
  const raw = [latest.fip.nose, latest.fip.palate, latest.fip.finish, latest.fip.complexity, latest.fip.value]
  return raw.map((v, i) => v / (RADAR_MAXES[i] ?? 1))
}

export function CompareTab({ bottle, otherBottles, pours }: CompareTabProps) {
  const [otherId, setOtherId] = useState('')
  const [voted, setVoted] = useState<string | null>(null)
  const { user } = useAuth()

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

  const bottleRadar = other ? radarValues(bottle, pours) : undefined
  const otherRadar = other ? radarValues(other, pours) : undefined

  async function handleVote(winner: string) {
    if (!other || !user) return
    await castFaceoffVote(user.uid, user.displayName ?? user.email ?? 'Anonymous', bottle.name, other.name, winner)
    setVoted(winner)
  }

  return (
    <>
      <div className={styles.picker}>
        <select
          className={controlClassName}
          value={otherId}
          onChange={(e) => {
            setOtherId(e.target.value)
            setVoted(null)
          }}
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
        <>
          <div className={styles.faceoffHeader}>
            <div className={styles.faceoffBottle}>
              <div className={styles.faceoffImageWrap}>
                {bottle.imageUrl ? (
                  <img className={styles.faceoffImage} src={bottle.imageUrl} alt="" />
                ) : (
                  <BottlePlaceholder name={bottle.name} />
                )}
              </div>
              <div className={styles.faceoffName}>{bottle.name}</div>
              <div className={styles.faceoffScore}>{formatScore(getCurrentScore(bottle, pours))}</div>
            </div>
            <div className={styles.vs}>VS</div>
            <div className={styles.faceoffBottle}>
              <div className={styles.faceoffImageWrap}>
                {other.imageUrl ? (
                  <img className={styles.faceoffImage} src={other.imageUrl} alt="" />
                ) : (
                  <BottlePlaceholder name={other.name} />
                )}
              </div>
              <div className={styles.faceoffName}>{other.name}</div>
              <div className={styles.faceoffScore}>{formatScore(getCurrentScore(other, pours))}</div>
            </div>
          </div>

          {bottleRadar && otherRadar ? (
            <div className={styles.radarWrap}>
              <RadarChart
                axes={RADAR_AXES}
                series={[
                  { label: bottle.name, color: 'var(--fip-amber)', values: bottleRadar },
                  { label: other.name, color: 'var(--fip-brass)', values: otherRadar },
                ]}
              />
              <div className={styles.legend}>
                <span className={styles.legendItem} style={{ color: 'var(--fip-amber)' }}>
                  ● {bottle.name}
                </span>
                <span className={styles.legendItem} style={{ color: 'var(--fip-brass)' }}>
                  ● {other.name}
                </span>
              </div>
            </div>
          ) : null}

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

          <div className={styles.voteRow}>
            {voted ? (
              <p className={styles.voteThanks}>Thanks for voting — you picked {voted}.</p>
            ) : (
              <>
                <span className={styles.voteLabel}>Which wins?</span>
                <Button variant="secondary" onClick={() => handleVote(bottle.name)}>
                  {bottle.name}
                </Button>
                <Button variant="secondary" onClick={() => handleVote(other.name)}>
                  {other.name}
                </Button>
              </>
            )}
          </div>
        </>
      ) : (
        <EmptyState title="Pick a bottle above." message="Compare FIP score, proof, price, and more side by side." />
      )}
    </>
  )
}
