import { formatScore } from './partyLabels'
import { GROUP_LABEL, GROUPS } from './dualGroups'
import type { PartyCategoryResults, PartyGroup, PartyGroupResults } from './types'
import styles from './party.module.css'
import r from './results.module.css'

function names(results: PartyCategoryResults, labels: string[]): string {
  return labels.map((l) => results.samples.find((s) => s.label === l)?.bottle.name ?? `Sample ${l}`).join(' & ')
}

// Every rating the group gave in this round, averaged (not an average of
// averages), so a bottle with fewer ratings doesn't count as much.
function groupAverage(group: PartyGroupResults): number | null {
  const count = group.samples.reduce((sum, s) => sum + s.count, 0)
  if (!count) return null
  const total = group.samples.reduce((sum, s) => sum + (s.average ?? 0) * s.count, 0)
  return Math.round((total / count) * 100) / 100
}

function winnerText(results: PartyCategoryResults, labels: string[], empty: string): string {
  if (!labels.length) return empty
  return `${names(results, labels)}${labels.length > 1 ? ' (tie)' : ''}`
}

// Dual Experience: Guided vs. Blind for one revealed round. Averages always
// travel with how many ratings they come from, groups are never compared
// by raw totals (they're different sizes), and differences are presented
// as what happened, not why.
export function DualComparison({ results, presentation = false }: { results: PartyCategoryResults; presentation?: boolean }) {
  const groups = results.groups
  const comparison = results.comparison
  if (!groups || !comparison) return null
  const max = 10
  const rows: { metric: string; values: Record<PartyGroup, string> }[] = [
    { metric: 'Tasters', values: { guided: String(groups.guided.ballotsCounted), blind: String(groups.blind.ballotsCounted) } },
    {
      metric: 'Favorite bottle',
      values: { guided: winnerText(results, groups.guided.champions, '—'), blind: winnerText(results, groups.blind.champions, '—') },
    },
    { metric: 'Average score', values: { guided: formatScore(groupAverage(groups.guided)), blind: formatScore(groupAverage(groups.blind)) } },
    {
      metric: 'People’s Choice',
      values: { guided: winnerText(results, groups.guided.peoplesChoice, 'No votes'), blind: winnerText(results, groups.blind.peoplesChoice, 'No votes') },
    },
  ]

  return (
    <section className={presentation ? `${styles.stack} ${r.presentation}` : styles.stack} aria-labelledby={`dual-${results.categoryId}`}>
      <h3 id={`dual-${results.categoryId}`} className={styles.sectionTitle}>
        Guided vs. Blind
      </h3>
      <div className={r.tableWrap}>
        <table className={`${r.table} ${r.groupTable}`}>
          <caption className={styles.srOnly}>{results.name}: guided and blind groups compared</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {GROUPS.map((g) => (
                <th key={g} scope="col">
                  {GROUP_LABEL[g]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.metric}>
                <th scope="row">{row.metric}</th>
                {GROUPS.map((g) => (
                  <td key={g}>{row.values[g]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className={r.compareList} aria-label="Each bottle, guided and blind">
        {comparison.samples.map((sample) => {
          const name = results.samples.find((s) => s.label === sample.label)?.bottle.name ?? `Sample ${sample.label}`
          return (
            <li key={sample.label} className={r.compareItem}>
              <div className={styles.spread}>
                <strong>{name}</strong>
                <span className={styles.muted}>Sample {sample.label}</span>
              </div>
              {GROUPS.map((g) => {
                const side = sample[g]
                return (
                  <div key={g} className={r.compareRow}>
                    <span className={r.compareLabel}>{GROUP_LABEL[g]}</span>
                    <span className={r.compareTrack} aria-hidden="true">
                      <span
                        className={`${r.compareFill} ${g === 'blind' ? r.compareFillBlind : ''}`}
                        style={{ width: `${side.average === null ? 0 : (side.average / max) * 100}%` }}
                      />
                    </span>
                    <span className={r.compareValue}>
                      {side.average === null ? 'No ratings' : `${formatScore(side.average)} / 10`}
                      <span className={r.averageOf}>
                        {' '}
                        · {side.count} {side.count === 1 ? 'rating' : 'ratings'}
                      </span>
                    </span>
                  </div>
                )
              })}
            </li>
          )
        })}
      </ul>

      <ul className={r.awards} aria-label="Guided and blind highlights">
        <li className={r.award}>
          <span className={styles.eyebrow}>Guided winner</span>
          <strong>{winnerText(results, groups.guided.champions, 'No scores')}</strong>
        </li>
        <li className={r.award}>
          <span className={styles.eyebrow}>Blind winner</span>
          <strong>{winnerText(results, groups.blind.champions, 'No scores')}</strong>
        </li>
        <li className={r.award}>
          <span className={styles.eyebrow}>Overall favorite</span>
          <strong>{winnerText(results, results.champions, 'No scores')}</strong>
          <span className={styles.muted}>Highest average across every ballot in the room.</span>
        </li>
        {comparison.largestDifference.length ? (
          <li className={r.award}>
            <span className={styles.eyebrow}>Largest difference</span>
            <strong>{winnerText(results, comparison.largestDifference, '—')}</strong>
            <span className={styles.muted}>{formatScore(comparison.largestDifferenceValue)} points apart.</span>
          </li>
        ) : null}
        <li className={r.award}>
          <span className={styles.eyebrow}>Both groups enjoyed</span>
          <strong>{comparison.bothEnjoyed.length ? names(results, comparison.bothEnjoyed) : 'None this round'}</strong>
          <span className={styles.muted}>Both group averages {comparison.bothEnjoyedMin} or higher.</span>
        </li>
      </ul>
      <p className={styles.muted}>
        {comparison.sameWinner ? 'Both groups crowned the same bottle. ' : ''}
        The groups are different sizes, so compare averages, not totals. Differences show how each group scored, not why: knowing the bottle is one
        of many things that can shape a score.
        {groups.blind.unblindedBallots
          ? ` ${groups.blind.unblindedBallots} blind ${groups.blind.unblindedBallots === 1 ? 'ballot was' : 'ballots were'} not fully blind and still counted.`
          : ''}
      </p>
    </section>
  )
}
