import { formatScore } from './partyLabels'
import type { PartyEventStandings, PartyStandingEntry } from './types'
import styles from './party.module.css'

function names(entries: PartyStandingEntry[] | undefined): string {
  if (!entries || !entries.length) return 'No ratings yet'
  return entries.map((e) => e.bottle.name).join(' & ')
}

function avg(entries: PartyStandingEntry[] | undefined): string {
  const e = entries?.[0]
  return e && e.average !== null ? `${formatScore(e.average)} avg` : ''
}

// Event-wide results from results/event, which the server builds from
// revealed rounds only. Shared ranks are shown as ties ("T1").
export function EventStandingsView({ standings, totalFlights }: { standings: PartyEventStandings; totalFlights: number }) {
  if (!standings.roundsRevealed) return null
  const partial = standings.roundsRevealed < totalFlights
  const tiedRanks = new Set<number>()
  const seen = new Map<number, number>()
  for (const e of standings.overall) if (e.rank !== null) seen.set(e.rank, (seen.get(e.rank) ?? 0) + 1)
  for (const [rank, n] of seen) if (n > 1) tiedRanks.add(rank)
  const rankLabel = (rank: number | null) => (rank === null ? '—' : `${tiedRanks.has(rank) ? 'T' : ''}${rank}`)

  return (
    <section className={`${styles.card} ${styles.cardHighlight}`} aria-labelledby="event-results-heading" data-testid="event-standings">
      <span className={styles.eyebrow}>Event results{partial ? ` · ${standings.roundsRevealed} of ${totalFlights} flights revealed` : ''}</span>
      <h2 id="event-results-heading" className={styles.sectionTitle}>
        Overall favorite: {names(standings.overallFavorite)}
      </h2>
      <p className={styles.muted}>{avg(standings.overallFavorite)}</p>

      {standings.guidedFavorite || standings.blindFavorite ? (
        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Guided favorite</span>
            <span className={styles.subtitle}>{names(standings.guidedFavorite)}</span>
            <span className={styles.statLabel}>{avg(standings.guidedFavorite)}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statLabel}>Blind favorite</span>
            <span className={styles.subtitle}>{names(standings.blindFavorite)}</span>
            <span className={styles.statLabel}>{avg(standings.blindFavorite)}</span>
          </div>
        </div>
      ) : null}

      <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        <h3 className={styles.label}>Top three</h3>
        <ol className={styles.list} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {standings.topThree.map((e) => (
            <li key={e.key} className={styles.listItem}>
              <span className={styles.sampleBadgeSmall} aria-label={`Rank ${rankLabel(e.rank)}`}>
                {rankLabel(e.rank)}
              </span>
              <span className={styles.grow}>
                {e.bottle.name}
                <span className={styles.muted} style={{ display: 'block', fontSize: 'var(--fip-text-xs)' }}>
                  {e.categoryName} · {formatScore(e.average)} avg from {e.count} ratings
                </span>
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        <h3 className={styles.label}>Flight favorites</h3>
        {standings.flightFavorites.map((f) => (
          <p key={f.categoryId} className={styles.muted} style={{ margin: 0 }}>
            <strong>{f.categoryName}:</strong> {f.winners.length ? f.winners.map((w) => w.bottle.name).join(' & ') : 'no ratings'}
            {f.winners.length > 1 ? ' (tie)' : ''}
          </p>
        ))}
      </div>

      {standings.differences?.length ? (
        <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
          <h3 className={styles.label}>Guided vs. blind</h3>
          <p className={styles.muted} style={{ fontSize: 'var(--fip-text-xs)' }}>
            Group averages, largest gaps first. The groups are different sizes, so read these as observations, not proof of anything.
          </p>
          <ul className={styles.list} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {standings.differences.slice(0, 9).map((d) => (
              <li key={`${d.categoryId}:${d.label}`} className={styles.listItem}>
                <span className={styles.grow}>
                  {d.bottle.name}
                  <span className={styles.muted} style={{ display: 'block', fontSize: 'var(--fip-text-xs)' }}>
                    Guided {formatScore(d.guided.average)} ({d.guided.count}) · Blind {formatScore(d.blind.average)} ({d.blind.count})
                  </span>
                </span>
                <span className={styles.pill}>
                  {d.difference > 0 ? '+' : ''}
                  {formatScore(d.difference)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
