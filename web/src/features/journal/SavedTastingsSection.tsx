import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Section } from '../../components/layout/Section'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import type { SavedTasting } from '../../data/types'
import styles from './SavedTastingsSection.module.css'

function formatDay(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

// My Tastings: tastings saved from hosted events, newest first. They're
// history only: removing one never touches My Bar or a party's results.
export function SavedTastingsSection({ tastings }: { tastings: SavedTasting[] }) {
  const { deleteSavedTasting } = useUserData()
  const [confirming, setConfirming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  if (tastings.length === 0) return null
  const sorted = [...tastings].sort((a, b) => b.date.localeCompare(a.date) || b.savedAt - a.savedAt)

  async function remove(id: string) {
    setError(null)
    try {
      await deleteSavedTasting(id)
      setConfirming(null)
    } catch {
      setError('Couldn’t remove that tasting. Try again.')
    }
  }

  return (
    <Section title="My Tastings">
      <p className={styles.intro}>From tasting events. They count toward Your Palate; nothing here changes your bar.</p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <ul className={styles.list}>
        {sorted.slice(0, 12).map((t) => (
          <li key={t.id} className={styles.item}>
            <div className={styles.main}>
              <div className={styles.head}>
                {t.bottleId ? (
                  <Link to={`/collection/${t.bottleId}`} className={styles.name}>
                    {t.bottle.name}
                  </Link>
                ) : (
                  <span className={styles.name}>{t.bottle.name}</span>
                )}
                <span className={styles.score} aria-label={`Overall ${t.overall} out of 10`}>
                  {t.overall.toFixed(1).replace(/\.0$/, '')}
                </span>
              </div>
              <div className={styles.meta}>
                {t.eventName} · {t.categoryName} · {formatDay(t.date)}
              </div>
              <div className={styles.tags}>
                <Badge tone={t.format === 'blind' ? 'amber' : 'default'}>
                  {t.format === 'blind' ? `Blind · Sample ${t.label}` : t.experience === 'guided' ? 'Guided' : 'Regular'}
                </Badge>
                {t.favorite ? <Badge>Your favorite</Badge> : null}
                {t.notFullyBlind ? <Badge>Not fully blind</Badge> : null}
              </div>
              {t.descriptors.length ? <div className={styles.meta}>{t.descriptors.join(', ')}</div> : null}
              {t.notes ? <p className={styles.notes}>{t.notes}</p> : null}
            </div>
            {confirming === t.id ? (
              <div className={styles.actions}>
                <Button variant="ghost" onClick={() => setConfirming(null)}>
                  Keep
                </Button>
                <Button variant="danger" onClick={() => void remove(t.id)}>
                  Remove
                </Button>
              </div>
            ) : (
              <Button variant="ghost" aria-label={`Remove ${t.bottle.name} from My Tastings`} onClick={() => setConfirming(t.id)}>
                Remove
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  )
}
