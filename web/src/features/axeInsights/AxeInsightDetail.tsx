import { Link } from 'react-router-dom'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { fipTier } from '../fip/tiers'
import { parseLocalDate } from '../../data/localDate'
import type { Bottle, Pour } from '../../data/types'
import type { AxeExplanationResult } from '../../data/repositories/axeInsights'
import { usePourHub } from '../startAPour/usePourHub'
import { CATEGORY_LABEL, confidenceText, formatFactValue, periodText } from './insightDisplay'
import type { InsightAction, InsightCandidate } from './engine'
import styles from './AxeInsightDetail.module.css'

interface AxeInsightDetailProps {
  insight: InsightCandidate
  explanation: AxeExplanationResult
  bottles: Bottle[]
  pours: Pour[]
  onAskAxe: () => void
  onClose: () => void
}

const MAX_RECORDS = 5
const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function actionHref(action: InsightAction): string | undefined {
  switch (action.id) {
    case 'open-palate':
      return '/profile'
    case 'open-collection':
      return '/collection'
    case 'open-bottle':
      return action.bottleId ? `/collection/${action.bottleId}` : undefined
    case 'open-blind':
      return action.roomId ? `/blind/${action.roomId}/reveal` : undefined
    default:
      return undefined
  }
}

// The expanded AXE Insight. Wording may be AXE's (validated server-side);
// everything under "Verified from your records" is the engine's own facts
// and the user's own records, never model output.
export function AxeInsightDetail({ insight, explanation, bottles, pours, onAskAxe, onClose }: AxeInsightDetailProps) {
  const hub = usePourHub()
  const bottleById = new Map(bottles.map((b) => [b.id, b]))
  const relatedBottles = [...new Set([...insight.subjectBottleIds, ...insight.evidence.bottleIds])]
    .map((id) => bottleById.get(id))
    .filter((b): b is Bottle => Boolean(b))
    .slice(0, 6)
  const evidenceIds = new Set(insight.evidence.pourIds)
  const records = pours
    .filter((p) => evidenceIds.has(p.id))
    .sort((a, b) => b.date.localeCompare(a.date))
  const { headline, body, expanded } = explanation.explanation

  return (
    <Modal title={CATEGORY_LABEL[insight.category]} onClose={onClose}>
      <div className={styles.content}>
        <h3 className={styles.headline}>{headline}</h3>
        <p className={styles.body}>{body}</p>
        {expanded ? <p className={styles.body}>{expanded}</p> : null}
        <p className={styles.provenance}>
          {explanation.source === 'ai' ? 'Worded by AXE from the facts below.' : 'From the facts below.'}
        </p>

        <section className={styles.section} aria-labelledby="insight-facts">
          <h4 id="insight-facts" className={styles.sectionTitle}>
            Verified from your records
          </h4>
          <dl className={styles.facts}>
            {insight.facts.map((fact) => (
              <div className={styles.fact} key={fact.key}>
                <dt>{fact.label}</dt>
                <dd>{formatFactValue(fact)}</dd>
              </div>
            ))}
          </dl>
          <p className={styles.meta}>{confidenceText(insight)}</p>
          <p className={styles.meta}>Looked at: {periodText(insight)}</p>
        </section>

        {records.length > 0 ? (
          <section className={styles.section} aria-labelledby="insight-records">
            <h4 id="insight-records" className={styles.sectionTitle}>
              Tastings behind it
            </h4>
            <ul className={styles.records}>
              {records.slice(0, MAX_RECORDS).map((pour) => (
                <li key={pour.id} className={styles.record}>
                  <span className={styles.recordName}>{bottleById.get(pour.bottleId)?.name ?? 'A bottle no longer in your bar'}</span>
                  <span className={styles.recordDate}>{dateFormatter.format(parseLocalDate(pour.date))}</span>
                  <span className={styles.recordScore} style={{ color: fipTier(pour.rating).color }} title={fipTier(pour.rating).label}>
                    {pour.rating.toFixed(1)}
                  </span>
                </li>
              ))}
            </ul>
            {records.length > MAX_RECORDS ? <p className={styles.meta}>Showing the latest {MAX_RECORDS} of {records.length}.</p> : null}
          </section>
        ) : null}

        {relatedBottles.length > 0 ? (
          <section className={styles.section} aria-labelledby="insight-bottles">
            <h4 id="insight-bottles" className={styles.sectionTitle}>
              Bottles
            </h4>
            <ul className={styles.bottles}>
              {relatedBottles.map((bottle) => (
                <li key={bottle.id}>
                  <Link to={`/collection/${bottle.id}`} className={styles.bottleLink} onClick={onClose}>
                    {bottle.name}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <div className={styles.actions}>
          <Button onClick={onAskAxe}>Ask AXE About This</Button>
          {insight.actions.map((action) => {
            if (action.id === 'log-pour') {
              return (
                <Button key={action.id} variant="secondary" onClick={hub.open}>
                  {action.label}
                </Button>
              )
            }
            const href = actionHref(action)
            return href ? (
              <Link key={`${action.id}-${href}`} to={href} className={styles.actionLink} onClick={onClose}>
                <Button variant="secondary">{action.label}</Button>
              </Link>
            ) : null
          })}
        </div>
      </div>
      {hub.modal}
    </Modal>
  )
}
