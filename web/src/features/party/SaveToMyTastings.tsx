import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { buildSavedTastings } from './savedTastings'
import type { Party, PartyBallot, PartyCategory, PartyCategoryResults } from './types'
import styles from './party.module.css'

// After a round's bottles are known (revealed blind round, or a regular
// round's results), a signed-in taster can keep their own scores, notes and
// descriptors in My Tastings. Saving again updates the same records; it
// never adds bottles to My Bar or changes inventory. Anonymous guests see
// "Keep my results" instead (GuestPartyPage) and can save once signed in.
export function SaveToMyTastings({
  party,
  category,
  results,
  ballot,
}: {
  party: Party
  category: PartyCategory
  results: PartyCategoryResults
  ballot: PartyBallot | undefined
}) {
  const { user } = useAuth()
  const { userDoc, saveSavedTastings } = useUserData()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) return null
  const entries = buildSavedTastings({ party, category, results, ballot, myBar: userDoc.bottles })
  if (entries.length === 0) return null
  const savedIds = new Set((userDoc.tastings ?? []).map((t) => t.id))
  const alreadySaved = entries.every((e) => savedIds.has(e.id))
  const linked = entries.filter((e) => e.bottleId).length

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await saveSavedTastings(entries)
    } catch {
      setError('Couldn’t save to My Tastings. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className={`${styles.card} ${styles.cardWarm}`} aria-labelledby={`save-${category.id}`}>
      <h3 id={`save-${category.id}`} className={styles.sectionTitle}>
        {alreadySaved ? 'Saved to My Tastings ✓' : 'Keep your tasting'}
      </h3>
      <p className={styles.muted}>
        {alreadySaved
          ? `Your ${entries.length} ${entries.length === 1 ? 'pour is' : 'pours are'} in My Tastings and count toward Your Palate.`
          : `Save your scores, notes and flavors for ${entries.length} ${entries.length === 1 ? 'pour' : 'pours'} to My Tastings. Nothing is added to My Bar.`}
        {linked ? ` ${linked} ${linked === 1 ? 'matches a bottle' : 'match bottles'} in your bar.` : ''}
      </p>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {alreadySaved ? (
        <Link to="/journal" className={styles.backLink}>
          Open My Tastings →
        </Link>
      ) : (
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save to My Tastings'}
        </Button>
      )}
    </section>
  )
}
