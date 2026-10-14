import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import type { Bottle, Pour } from '../../data/types'
import { usePourHub } from '../startAPour/usePourHub'
import { useSommelier } from '../sommelier/SommelierProvider'
import { AxeSymbol } from '../sommelier/AxeMark'
import { AxeInsightDetail } from './AxeInsightDetail'
import { CATEGORY_LABEL } from './insightDisplay'
import { useAxeInsight } from './useAxeInsight'
import styles from './AxeInsightCard.module.css'

interface AxeInsightCardProps {
  uid: string
  bottles: Bottle[]
  pours: Pour[]
}

const asOfFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

// Home's single AXE Insight: one verified observation from the insight
// engine (server-cached), worded by AXE when a validated explanation
// exists, with the full evidence one tap away and follow-ups in the
// existing AXE chat.
export function AxeInsightCard({ uid, bottles, pours }: AxeInsightCardProps) {
  const { view, explanation, loading, freshness } = useAxeInsight(uid, bottles, pours)
  const { askAboutInsight } = useSommelier()
  const hub = usePourHub()
  const [expanded, setExpanded] = useState(false)
  const insight = view?.selected ?? null

  const brand = (
    <div className={styles.brand}>
      <AxeSymbol size={24} className={styles.mark} />
      <div className={styles.brandText}>
        <span className={styles.brandName}>AXE</span>
      </div>
    </div>
  )

  if (loading) {
    return (
      <section className={styles.card} aria-busy="true" aria-label="AXE Insight">
        {brand}
        <p className={styles.muted}>AXE is looking over your journey…</p>
      </section>
    )
  }

  if (!insight || !explanation) {
    const hasPours = pours.length > 0
    return (
      <section className={styles.card} aria-label="AXE Insight">
        {brand}
        <h3 className={styles.headline}>{hasPours ? 'AXE is still getting to know your palate.' : 'Your journey starts with a pour.'}</h3>
        <p className={styles.body}>
          {hasPours
            ? 'A few more rated tastings, ideally with flavor notes, and AXE will start pointing out what it notices.'
            : 'Log a tasting and AXE will start noticing what you enjoy.'}
        </p>
        <div className={styles.actions}>
          {hasPours ? (
            <Link to="/profile" className={styles.actionLink}>
              <Button variant="secondary">Explore Your Palate</Button>
            </Link>
          ) : (
            <Button variant="secondary" onClick={hub.open}>
              Log a Pour
            </Button>
          )}
        </div>
        {hub.modal}
      </section>
    )
  }

  const { headline, body } = explanation.explanation

  return (
    <section className={styles.card} aria-labelledby="axe-insight-headline">
      {brand}
      <p className={styles.category}>{CATEGORY_LABEL[insight.category]}</p>
      <h3 id="axe-insight-headline" className={styles.headline}>
        {headline}
      </h3>
      <p className={styles.body}>{body}</p>
      {freshness === 'updating' ? (
        <output className={styles.status}>Updating with your latest tastings…</output>
      ) : freshness === 'behind' && view?.calculatedAt ? (
        <p className={styles.status}>From your tastings as of {asOfFormatter.format(new Date(view.calculatedAt))}.</p>
      ) : null}
      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => setExpanded(true)} aria-haspopup="dialog">
          Explore Insight
        </Button>
        <button type="button" className={styles.askAxe} aria-haspopup="dialog" onClick={() => askAboutInsight(insight.id)}>
          Ask AXE
        </button>
      </div>

      {expanded ? (
        <AxeInsightDetail
          insight={insight}
          explanation={explanation}
          bottles={bottles}
          pours={pours}
          onClose={() => setExpanded(false)}
          onAskAxe={() => {
            setExpanded(false)
            askAboutInsight(insight.id)
          }}
        />
      ) : null}
    </section>
  )
}
