import type { Party, PartyCategory } from './types'
import styles from './party.module.css'

// Optional aroma stations, for everyone in the party. Category-level
// education only, never tied to a sample letter, so it's safe for blind
// tasters too.
export function AromaStations({ party }: { party: Party }) {
  const stations = party.extras?.stations ?? []
  if (!stations.length) return null
  return (
    <details className={styles.card}>
      <summary className={styles.spread} style={{ cursor: 'pointer', minHeight: 44 }}>
        <span className={styles.sectionTitle}>Aroma stations</span>
        <span className={styles.pill}>{stations.length}</span>
      </summary>
      <ul className={styles.list} aria-label="Aroma stations">
        {stations.map((station) => (
          <li key={station.id ?? station.name} className={styles.stack} style={{ gap: 2 }}>
            <strong>{station.name}</strong>
            {station.description ? <span className={styles.muted}>{station.description}</span> : null}
            {station.guidance ? <span className={styles.muted}>Try this: {station.guidance}</span> : null}
          </li>
        ))}
      </ul>
    </details>
  )
}

// A round's pairing, shown once the taster has scored every sample (or
// voting has closed), so it never colors their first impressions.
export function PairingNote({ party, category, ready }: { party: Party; category: PartyCategory; ready: boolean }) {
  const pairing = party.extras?.pairings?.[category.id]
  if (!pairing || !ready) return null
  return (
    <section className={`${styles.card} ${styles.cardWarm}`} aria-label={`Pairing for ${category.name}`}>
      <span className={styles.eyebrow}>Now try a pairing</span>
      <p className={styles.subtitle}>{pairing.name}</p>
      {pairing.note ? <p className={styles.muted}>{pairing.note}</p> : null}
    </section>
  )
}
