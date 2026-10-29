import { Button } from '../../../components/ui/Button'
import { SUGGESTED_PAIRINGS, SUGGESTED_STATIONS, type DraftCategory } from '../setupDraft'
import type { PartyStation } from '../types'
import styles from '../party.module.css'

const MAX_STATIONS = 8

// Optional aroma stations and per-round pairings. Everyone in the party
// sees these, blind tasters too, so they describe the round, never a
// specific sample or bottle.
export function ExtrasEditor({
  categories,
  stations,
  pairings,
  onStations,
  onPairings,
}: {
  categories: DraftCategory[]
  stations: PartyStation[]
  pairings: Record<string, { name: string; note: string }>
  onStations: (next: PartyStation[]) => void
  onPairings: (next: Record<string, { name: string; note: string }>) => void
}) {
  function updateStation(index: number, patch: Partial<PartyStation>) {
    onStations(stations.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  function addSuggestedStations() {
    const have = new Set(stations.map((s) => s.name.trim().toLowerCase()))
    onStations([...stations, ...SUGGESTED_STATIONS.filter((s) => !have.has(s.name.toLowerCase()))].slice(0, MAX_STATIONS))
  }

  function suggestPairings() {
    const next = { ...pairings }
    for (const c of categories) {
      const suggestion = c.libraryId ? SUGGESTED_PAIRINGS[c.libraryId] : undefined
      if (suggestion && !next[c.key]?.name.trim()) next[c.key] = { name: suggestion, note: '' }
    }
    onPairings(next)
  }

  const canSuggestPairings = categories.some((c) => c.libraryId && SUGGESTED_PAIRINGS[c.libraryId] && !pairings[c.key]?.name.trim())

  return (
    <section className={styles.card} aria-labelledby="extras-heading">
      <h2 id="extras-heading" className={styles.sectionTitle}>
        Aroma stations and pairings (optional)
      </h2>
      <p className={styles.muted}>
        Everyone sees these, blind tasters included, so describe the round, not a bottle. Pairings appear after each taster finishes scoring the round.
      </p>

      <h3 className={styles.label}>Aroma stations</h3>
      {stations.length === 0 ? <p className={styles.muted}>No stations yet.</p> : null}
      {stations.map((station, index) => (
        <fieldset key={station.id ?? index} className={styles.fieldset} aria-label={`Station ${index + 1}`}>
          <div className={styles.spread}>
            <label className={styles.label} htmlFor={`station-name-${index}`}>
              Station {index + 1}
            </label>
            <Button variant="ghost" aria-label={`Remove station ${station.name || index + 1}`} onClick={() => onStations(stations.filter((_, i) => i !== index))}>
              Remove
            </Button>
          </div>
          <input
            id={`station-name-${index}`}
            className={styles.input}
            maxLength={60}
            placeholder="Oak"
            value={station.name}
            onChange={(e) => updateStation(index, { name: e.target.value })}
          />
          <input
            className={styles.input}
            maxLength={300}
            aria-label={`Station ${index + 1} description`}
            placeholder="What's at the station"
            value={station.description}
            onChange={(e) => updateStation(index, { description: e.target.value })}
          />
          <input
            className={styles.input}
            maxLength={300}
            aria-label={`Station ${index + 1} tasting guidance`}
            placeholder="What to notice"
            value={station.guidance}
            onChange={(e) => updateStation(index, { guidance: e.target.value })}
          />
        </fieldset>
      ))}
      <div className={styles.row}>
        <Button
          variant="secondary"
          disabled={stations.length >= MAX_STATIONS}
          onClick={() => onStations([...stations, { name: '', description: '', guidance: '' }])}
        >
          Add a station
        </Button>
        {stations.length < MAX_STATIONS ? (
          <Button variant="ghost" onClick={addSuggestedStations}>
            Add suggested stations
          </Button>
        ) : null}
      </div>

      <h3 className={styles.label}>Pairings by round</h3>
      {categories.length === 0 ? <p className={styles.muted}>Add rounds first.</p> : null}
      {categories.map((c) => (
        <div key={c.key} className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
          <label className={styles.label} htmlFor={`pairing-${c.key}`}>
            {c.name || 'Untitled round'}
          </label>
          <input
            id={`pairing-${c.key}`}
            className={styles.input}
            maxLength={80}
            placeholder="No pairing"
            value={pairings[c.key]?.name ?? ''}
            onChange={(e) => onPairings({ ...pairings, [c.key]: { name: e.target.value, note: pairings[c.key]?.note ?? '' } })}
          />
          {pairings[c.key]?.name ? (
            <input
              className={styles.input}
              maxLength={200}
              aria-label={`${c.name} pairing note`}
              placeholder="A note (optional)"
              value={pairings[c.key]?.note ?? ''}
              onChange={(e) => onPairings({ ...pairings, [c.key]: { name: pairings[c.key]?.name ?? '', note: e.target.value } })}
            />
          ) : null}
        </div>
      ))}
      {canSuggestPairings ? (
        <Button variant="ghost" onClick={suggestPairings}>
          Suggest pairings
        </Button>
      ) : null}
    </section>
  )
}
