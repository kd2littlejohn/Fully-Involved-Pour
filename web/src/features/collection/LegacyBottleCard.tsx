import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { useUserData } from '../../hooks/useUserData'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu'
import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'
import { splitBottleTitle } from './bottleTitle'
import { legacyBottles } from './legacyBottles'
import { LegacyBottlePicker } from './LegacyBottlePicker'
import styles from './LegacyBottleCard.module.css'

const STATUS_LABEL: Record<BottleStatus, string> = {
  open: 'Opened',
  sealed: 'Sealed',
  wishlist: 'Wishlist',
  finished: 'Finished',
  incoming: 'Incoming',
}

// My Bar's featured Legacy Bottle: the bottle that means the most, shown
// with its real photo and its story, linking to its Journey (pours and
// memories). It stays in the normal inventory below; this only features
// it. With none designated, a quiet one-line invitation instead of an
// empty card.
export function LegacyBottleCard({ bottles }: { bottles: Bottle[] }) {
  const { updateBottle } = useUserData()
  const legacy = legacyBottles(bottles)
  const [index, setIndex] = useState(0)
  const [picking, setPicking] = useState(false)

  const picker = picking ? <LegacyBottlePicker bottles={bottles} onClose={() => setPicking(false)} /> : null

  if (legacy.length === 0) {
    return (
      <>
        <div className={styles.prompt}>
          <span className={styles.promptText}>Have a bottle that means more than the rest?</span>
          <button type="button" className={styles.promptButton} onClick={() => setPicking(true)}>
            Choose a Legacy Bottle
          </button>
        </div>
        {picker}
      </>
    )
  }

  const bottle = legacy[index % legacy.length]!
  const { title, subtitle } = splitBottleTitle(bottle.name)
  const photo = bottlePhotoUrl(bottle)
  const story = bottle.legacyShelfReason?.trim()
  const bottleId = bottle.id

  const menuItems: OverflowMenuItem[] = [
    { label: 'Add a Legacy Bottle', onClick: () => setPicking(true) },
    { label: 'Remove Legacy status', onClick: () => void updateBottle(bottleId, { legacyShelf: false }) },
  ]

  return (
    <>
      <section className={styles.card} aria-labelledby="legacy-bottle-title">
        <Link to={`/collection/${bottle.id}`} className={styles.media} aria-label={`View ${bottle.name}`}>
          {photo ? (
            <>
              <img className={styles.backdrop} src={photo} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <img className={styles.photo} src={photo} alt="" loading="lazy" decoding="async" />
            </>
          ) : (
            <BottlePlaceholder name={bottle.name} compact />
          )}
        </Link>

        <div className={styles.body}>
          <div className={styles.header}>
            <p className={styles.eyebrow}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 2l2.6 6.3 6.8.6-5.2 4.5 1.6 6.6L12 16.6 6.2 20l1.6-6.6L2.6 8.9l6.8-.6L12 2z" />
              </svg>
              Legacy Bottle
            </p>
            <OverflowMenu items={menuItems} label="Legacy Bottle actions" />
          </div>
          <h2 id="legacy-bottle-title" className={styles.name}>
            {title}
            {subtitle ? (
              <>
                {' '}
                <span className={styles.batch}>{subtitle}</span>
              </>
            ) : null}
          </h2>
          <p className={styles.meta}>{[bottle.distillery, STATUS_LABEL[bottle.status]].filter(Boolean).join(' · ')}</p>
          <p className={story ? styles.story : styles.storyEmpty}>{story ? `“${story}”` : 'Every pour has a story.'}</p>
          <div className={styles.actions}>
            <Link to={`/collection/${bottle.id}`} state={{ initialTab: 'journey' }} className={styles.storyLink}>
              Open Story
            </Link>
            {legacy.length > 1 ? (
              <button type="button" className={styles.next} onClick={() => setIndex((i) => (i + 1) % legacy.length)}>
                {(index % legacy.length) + 1} of {legacy.length}
                <span aria-hidden="true"> ›</span>
                <span className={styles.srOnly}> — show the next Legacy Bottle</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>
      {picker}
    </>
  )
}
