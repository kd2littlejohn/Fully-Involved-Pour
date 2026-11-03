import { useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import fipIcon from '../../assets/brand/fip-icon.svg'
import { buildGraduation } from './graduation'
import { renderGraduationImage } from './graduationImage'
import { buildSavedTastings } from './savedTastings'
import { formatScore } from './partyLabels'
import type { Party, PartyBallot, PartyCategoryResults, PartyGroup } from './types'
import styles from './party.module.css'

// The taster's graduation: event completion, pours rated, favorite bottle
// and flight, their most-noticed flavors and a tasting profile, with Save
// to my FIP profile (graduation plus every pour to My Tastings) and a
// shareable card. Appears once rounds are revealed.
export function GraduationCard({
  party,
  ballots,
  results,
  group,
  name,
}: {
  party: Party
  ballots: PartyBallot[]
  results: Record<string, PartyCategoryResults>
  group: PartyGroup | null
  name: string
}) {
  const { user } = useAuth()
  const { userDoc, saveGraduation, saveSavedTastings } = useUserData()
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const graduation = useMemo(() => buildGraduation({ party, ballots, results, group }), [party, ballots, results, group])
  if (!graduation) return null
  const saved = (userDoc.graduations ?? []).some((g) => g.id === graduation.id)

  async function save() {
    if (!graduation) return
    setSaving(true)
    setStatus(null)
    try {
      const tastings = party.categories.flatMap((category) =>
        buildSavedTastings({ party, category, results: results[category.id], ballot: ballots.find((b) => b.categoryId === category.id), myBar: userDoc.bottles, group }),
      )
      await saveSavedTastings(tastings)
      await saveGraduation(graduation)
      setStatus(`Saved to your FIP profile, with ${tastings.length} pours in My Tastings.`)
    } catch {
      setStatus('Couldn’t save right now. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  async function share() {
    if (!graduation) return
    setStatus(null)
    try {
      const blob = await renderGraduationImage(graduation, name)
      const file = new File([blob], `${graduation.eventName.replace(/[^\w-]+/g, '-')}-graduation.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `${graduation.eventName} — Graduation`, text: `I graduated from ${graduation.eventName}: ${graduation.profile.title}.` })
        return
      }
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setStatus('Graduation card saved.')
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setStatus('Couldn’t create the card on this device.')
    }
  }

  const g = graduation
  return (
    <section className={`${styles.card} ${styles.cardHighlight}`} aria-labelledby="graduation-heading" data-testid="graduation">
      <div className={styles.row}>
        <img className={styles.brandMark} src={fipIcon} alt="" aria-hidden="true" />
        <span className={styles.eyebrow}>{g.completed ? 'Graduation' : 'Your progress so far'}</span>
      </div>
      <h2 id="graduation-heading" className={styles.title} style={{ fontSize: 'var(--fip-text-2xl, 1.6rem)' }}>
        {g.completed ? `Congratulations, ${name}!` : `${name}, here’s your tasting so far`}
      </h2>
      <p className={styles.subtitle}>{g.profile.title}</p>
      <p className={styles.muted}>{g.profile.summary}</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statValue}>
            {g.poursRated}
            <span className={styles.statLabel}> / {g.totalPours}</span>
          </span>
          <span className={styles.statLabel}>Pours rated</span>
        </div>
        {g.versusRoom !== null ? (
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {g.versusRoom > 0 ? '+' : ''}
              {formatScore(g.versusRoom)}
            </span>
            <span className={styles.statLabel}>vs. the room</span>
          </div>
        ) : null}
      </div>
      <dl className={styles.stack} style={{ gap: 'var(--fip-space-2)', margin: 0 }}>
        <div>
          <dt className={styles.label}>Favorite bottle</dt>
          <dd style={{ margin: 0 }}>
            {g.favoriteBottles.map((b) => `${b.name} (${formatScore(b.overall)})`).join(' & ')}
          </dd>
        </div>
        {g.favoriteFlight ? (
          <div>
            <dt className={styles.label}>Favorite flight</dt>
            <dd style={{ margin: 0 }}>
              {g.favoriteFlight.name} · {formatScore(g.favoriteFlight.average)} avg
            </dd>
          </div>
        ) : null}
        {g.topFlavors.length ? (
          <div>
            <dt className={styles.label}>Flavors you noticed most</dt>
            <dd style={{ margin: 0 }}>{g.topFlavors.join(', ')}</dd>
          </div>
        ) : null}
      </dl>
      <div className={styles.row}>
        {user ? (
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : saved ? 'Update my FIP profile' : 'Save to my FIP profile'}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={() => void share()}>
          Share graduation card
        </Button>
      </div>
      {!user ? <p className={styles.muted}>Use “Keep my results” below to save this to an FIP account.</p> : null}
      {status ? (
        <p className={styles.muted} role="status">
          {status}
        </p>
      ) : null}
    </section>
  )
}
