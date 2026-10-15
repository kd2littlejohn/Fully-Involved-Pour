import { Link } from 'react-router-dom'
import type { Bottle } from '../../data/types'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { formatLegacyDate, hasLegacyStory } from './legacyBottles'
import styles from './LegacyStory.module.css'

// The complete Legacy Story behind the card's one-line quote, with Edit
// right there. Pours and memories stay on the bottle's Journey tab.
export function LegacyStoryView({ bottle, onClose, onEdit }: { bottle: Bottle; onClose: () => void; onEdit: () => void }) {
  const title = bottle.legacyStoryTitle?.trim()
  const reason = bottle.legacyShelfReason?.trim()
  const story = bottle.legacyStory?.trim()
  const occasion = bottle.legacyOccasion?.trim()
  const date = bottle.legacyDate

  return (
    <Modal title="Legacy Story" onClose={onClose}>
      <div className={styles.stack}>
        <p className={styles.bottleName}>{bottle.name}</p>
        {title ? <h3 className={styles.storyTitle}>{title}</h3> : null}
        {reason ? <p className={styles.reason}>{`“${reason}”`}</p> : null}
        {story ? <p className={styles.story}>{story}</p> : null}
        {occasion || date ? (
          <dl className={styles.details}>
            {occasion ? (
              <>
                <dt>Occasion</dt>
                <dd>{occasion}</dd>
              </>
            ) : null}
            {date ? (
              <>
                <dt>Date</dt>
                <dd>{formatLegacyDate(date)}</dd>
              </>
            ) : null}
          </dl>
        ) : null}
        {!hasLegacyStory(bottle) ? <p className={styles.hint}>No story yet. Every pour has one — write down what this bottle means to you.</p> : null}

        <div className={styles.viewActions}>
          <Link to={`/collection/${bottle.id}`} state={{ initialTab: 'journey' }} className={styles.journeyLink}>
            Pours &amp; memories →
          </Link>
          <Button onClick={onEdit}>{hasLegacyStory(bottle) ? 'Edit' : 'Write the story'}</Button>
        </div>
      </div>
    </Modal>
  )
}
