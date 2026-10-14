import { formatScore, ordinal } from './partyLabels'
import type { PartyCategoryResults, PartyResultSample } from './types'
import styles from './party.module.css'
import r from './results.module.css'

interface ResultsViewProps {
  results: PartyCategoryResults
  // The viewer's own participant key, to highlight "You" in comparisons.
  myParticipantKey?: string
  // Large type for the TV display.
  presentation?: boolean
  showComparisons?: boolean
}

function BottleImage({ sample, size }: { sample: PartyResultSample; size: 'lg' | 'sm' }) {
  return sample.bottle.imageUrl ? (
    <img className={size === 'lg' ? r.bottleImage : r.bottleImageSmall} src={sample.bottle.imageUrl} alt="" />
  ) : (
    <span className={`${size === 'lg' ? r.bottleImage : r.bottleImageSmall} ${r.bottleImageEmpty}`} aria-hidden="true">
      {sample.label}
    </span>
  )
}

function details(sample: PartyResultSample): string {
  return [sample.bottle.distillery, sample.bottle.age, sample.bottle.proof ? `${sample.bottle.proof} proof` : null].filter(Boolean).join(' · ')
}

// The revealed round: podium, full standings, awards and (optionally)
// how each taster scored it. Shows only what the server published at
// reveal — averages over submitted ratings, with how many ratings each
// average is built from.
export function ResultsView({ results, myParticipantKey, presentation = false, showComparisons = true }: ResultsViewProps) {
  const podium = results.samples.filter((s) => s.rank !== null && s.rank <= 3)
  const labels = [...results.samples].map((s) => s.label).sort()
  const byLabel = new Map(results.samples.map((s) => [s.label, s]))

  return (
    <div className={presentation ? `${styles.stack} ${r.presentation}` : styles.stack} style={{ gap: 'var(--fip-space-5)' }}>
      {podium.length > 0 ? (
        <ol className={r.podium} aria-label={`${results.name} winners`}>
          {podium.map((sample, index) => (
            <li
              key={sample.label}
              className={`${r.podiumItem} ${sample.rank === 1 ? r.first : ''} ${styles.fadeIn}`}
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <span className={r.place}>{sample.rank === 1 ? (sample.isChampion && results.champions.length > 1 ? 'Tied for 1st' : 'Champion') : ordinal(sample.rank!)}</span>
              <BottleImage sample={sample} size="lg" />
              <span className={r.bottleName}>{sample.bottle.name}</span>
              <span className={styles.muted}>Sample {sample.label}{details(sample) ? ` · ${details(sample)}` : ''}</span>
              <span className={r.average}>
                {formatScore(sample.average)}
                <span className={r.averageOf}> avg · {sample.count} {sample.count === 1 ? 'rating' : 'ratings'}</span>
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={styles.muted}>No scores were submitted for this round.</p>
      )}

      {results.awards.length > 0 ? (
        <ul className={r.awards} aria-label="Awards">
          {results.awards.map((award) => (
            <li key={award.id} className={r.award}>
              <span className={styles.eyebrow}>{award.title}</span>
              <strong>{award.labels.map((l) => byLabel.get(l)?.bottle.name ?? l).join(' & ')}</strong>
              <span className={styles.muted}>{award.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className={r.tableWrap}>
        <table className={r.table}>
          <caption className={styles.srOnly}>{results.name} standings</caption>
          <thead>
            <tr>
              <th scope="col">Rank</th>
              <th scope="col">Bottle</th>
              <th scope="col">Average</th>
              <th scope="col">Ratings</th>
              <th scope="col">Favorites</th>
            </tr>
          </thead>
          <tbody>
            {results.samples.map((sample) => (
              <tr key={sample.label} className={sample.isChampion ? r.championRow : undefined}>
                <td>{sample.rank ? ordinal(sample.rank) : '—'}</td>
                <td>
                  <div className={r.bottleCell}>
                    <span className={`${styles.sampleBadge} ${styles.sampleBadgeSmall}`} aria-label={`Sample ${sample.label}`}>
                      {sample.label}
                    </span>
                    <span>
                      {sample.bottle.name}
                      {sample.isPeoplesChoice ? <span className={`${styles.pill} ${styles.pillLive} ${r.inlinePill}`}>People’s Choice</span> : null}
                    </span>
                  </div>
                </td>
                <td>{formatScore(sample.average)}</td>
                <td>{sample.count}</td>
                <td>{sample.favoriteVotes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={styles.muted}>
        Averages use only submitted overall-enjoyment ratings — a skipped sample never counts as zero. {results.ballotsCounted}{' '}
        {results.ballotsCounted === 1 ? 'ballot' : 'ballots'}, {results.ratingsCounted} ratings.
      </p>

      {showComparisons && results.guestScores.length > 0 ? (
        <section className={styles.stack} aria-labelledby={`compare-${results.categoryId}`}>
          <h3 id={`compare-${results.categoryId}`} className={styles.sectionTitle}>
            How everyone scored it
          </h3>
          <div className={r.tableWrap}>
            <table className={r.table}>
              <caption className={styles.srOnly}>Overall enjoyment by taster</caption>
              <thead>
                <tr>
                  <th scope="col">Taster</th>
                  {labels.map((label) => (
                    <th key={label} scope="col">
                      {label}
                    </th>
                  ))}
                  <th scope="col">Favorite</th>
                </tr>
              </thead>
              <tbody>
                {results.guestScores.map((guest) => {
                  const mine = guest.participantKey === myParticipantKey
                  return (
                    <tr key={guest.participantKey} className={mine ? r.mineRow : undefined}>
                      <th scope="row">
                        {mine ? 'You' : guest.name}
                        {guest.source === 'paper' ? <span className={styles.srOnly}> (paper ballot)</span> : null}
                      </th>
                      {labels.map((label) => (
                        <td key={label}>{formatScore(guest.scores[label])}</td>
                      ))}
                      <td>{guest.favoriteLabel ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  )
}

// "Your take" — how the viewer's own favorite compared with the room.
export function MyTake({ results, myScores }: { results: PartyCategoryResults; myScores: Record<string, number> }) {
  const entries = Object.entries(myScores)
  if (!entries.length) return null
  const best = Math.max(...entries.map(([, v]) => v))
  const myTop = entries.filter(([, v]) => v === best).map(([l]) => l)
  const champions = results.champions
  const agreed = myTop.some((l) => champions.includes(l))
  const name = (label: string) => results.samples.find((s) => s.label === label)?.bottle.name ?? `Sample ${label}`
  return (
    <section className={`${styles.card} ${styles.cardWarm}`} aria-label="Your take">
      <span className={styles.eyebrow}>Your take</span>
      <p className={styles.subtitle}>
        Your top pour was <strong>{myTop.map(name).join(' & ')}</strong> ({formatScore(best)}/10).{' '}
        {champions.length === 0 ? '' : agreed ? 'You agreed with the room!' : `The room crowned ${champions.map(name).join(' & ')}.`}
      </p>
    </section>
  )
}
