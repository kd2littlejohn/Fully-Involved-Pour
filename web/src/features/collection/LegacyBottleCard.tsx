import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Bottle, BottleStatus } from '../../data/types'
import { useUserData } from '../../hooks/useUserData'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { OverflowMenu, type OverflowMenuItem } from '../../components/ui/OverflowMenu'
import { bottlePhotoUrl } from '../photoUpload/bottlePhotoUrl'
import { splitBottleTitle } from './bottleTitle'
import { legacyBottles, legacyCardQuote } from './legacyBottles'
import { LegacyBottlePicker } from './LegacyBottlePicker'
import { LegacyStoryEditor } from './LegacyStoryEditor'
import { LegacyStoryView } from './LegacyStoryView'
import styles from './LegacyBottleCard.module.css'
import storyStyles from './LegacyStory.module.css'

const STATUS_LABEL: Record<BottleStatus, string> = {
  open: 'Opened',
  sealed: 'Sealed',
  wishlist: 'Wishlist',
  finished: 'Finished',
  incoming: 'Incoming',
}

type Sheet = 'view' | 'edit' | 'add' | 'change' | 'remove' | null

// My Bar's featured Legacy Bottle: the bottle that means the most, shown
// with its real photo and its story. It stays in the normal inventory
// below; this only features it. The ••• menu edits the story, moves Legacy
// status to another bottle, or removes it — all on the bottle record
// itself, never deleting the bottle or its history. With none designated,
// a quiet one-line invitation instead of an empty card.
export function LegacyBottleCard({ bottles }: { bottles: Bottle[] }) {
  const { updateBottle } = useUserData()
  const navigate = useNavigate()
  const legacy = legacyBottles(bottles)
  const [currentId, setCurrentId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const [removeError, setRemoveError] = useState<string | null>(null)

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  const toast = notice ? (
    <output className={storyStyles.toast} aria-live="polite">
      {notice}
    </output>
  ) : null

  const closeSheet = () => setSheet(null)

  if (legacy.length === 0) {
    return (
      <>
        <div className={styles.prompt}>
          <span className={styles.promptText}>Have a bottle that means more than the rest?</span>
          <button type="button" className={styles.promptButton} onClick={() => setSheet('add')}>
            Choose a Legacy Bottle
          </button>
        </div>
        {sheet === 'add' ? (
          <LegacyBottlePicker
            bottles={bottles}
            onClose={closeSheet}
            onSaved={(chosen) => {
              setCurrentId(chosen.id)
              setNotice('Legacy Bottle saved.')
            }}
          />
        ) : null}
        {toast}
      </>
    )
  }

  const position = Math.max(
    0,
    legacy.findIndex((b) => b.id === currentId),
  )
  const bottle = legacy[position]!
  const { title, subtitle } = splitBottleTitle(bottle.name)
  const photo = bottlePhotoUrl(bottle)
  const quote = legacyCardQuote(bottle)

  async function handleRemove() {
    setRemoving(true)
    setRemoveError(null)
    try {
      // Only the flag: the bottle, its story and its history all stay.
      await updateBottle(bottle.id, { legacyShelf: false })
    } catch {
      setRemoveError('Legacy status couldn’t be removed. Check your connection and try again.')
      setRemoving(false)
      return
    }
    setRemoving(false)
    setSheet(null)
    setCurrentId(null)
    setNotice('Legacy status removed. The bottle and its story are still in My Bar.')
  }

  const menuItems: OverflowMenuItem[] = [
    { label: 'Edit Legacy Story', onClick: () => setSheet('edit') },
    { label: 'Change Legacy Bottle', onClick: () => setSheet('change') },
    {
      label: 'View Bottle Details',
      onClick: () => navigate(`/collection/${bottle.id}`),
    },
    { label: 'Add another Legacy Bottle', onClick: () => setSheet('add') },
    {
      label: 'Remove Legacy Status',
      tone: 'danger',
      onClick: () => {
        setRemoveError(null)
        setSheet('remove')
      },
    },
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
          <p className={quote ? styles.story : styles.storyEmpty}>{quote ? `“${quote}”` : 'Every pour has a story.'}</p>
          <div className={styles.actions}>
            <button type="button" className={styles.storyLink} onClick={() => setSheet('view')}>
              Open Story
            </button>
            {legacy.length > 1 ? (
              <button type="button" className={styles.next} onClick={() => setCurrentId(legacy[(position + 1) % legacy.length]!.id)}>
                {position + 1} of {legacy.length}
                <span aria-hidden="true"> ›</span>
                <span className={styles.srOnly}> — show the next Legacy Bottle</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      {sheet === 'view' ? <LegacyStoryView bottle={bottle} onClose={closeSheet} onEdit={() => setSheet('edit')} /> : null}
      {sheet === 'edit' ? (
        <LegacyStoryEditor
          bottle={bottle}
          onClose={closeSheet}
          onSaved={() => {
            setSheet(null)
            setNotice('Legacy story saved.')
          }}
        />
      ) : null}
      {sheet === 'add' || sheet === 'change' ? (
        <LegacyBottlePicker
          bottles={bottles}
          replacing={sheet === 'change' ? bottle : undefined}
          onClose={closeSheet}
          onSaved={(chosen) => {
            setCurrentId(chosen.id)
            setNotice(sheet === 'change' ? `${chosen.name} is now your Legacy Bottle.` : 'Legacy Bottle saved.')
          }}
        />
      ) : null}
      {sheet === 'remove' ? (
        <Modal title="Remove Legacy status?" onClose={closeSheet}>
          <div className={storyStyles.stack}>
            <p className={storyStyles.hint}>
              {bottle.name} will no longer be featured as a Legacy Bottle. The bottle, its story, pours and tasting history all stay in My Bar — you can make it
              a Legacy Bottle again any time.
            </p>
            {removeError ? (
              <p className={storyStyles.error} role="alert">
                {removeError}
              </p>
            ) : null}
            <div className={storyStyles.buttons}>
              <Button variant="secondary" onClick={closeSheet} disabled={removing}>
                Keep it
              </Button>
              <Button variant="danger" onClick={() => void handleRemove()} disabled={removing}>
                {removing ? 'Removing…' : 'Remove Legacy status'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
      {toast}
    </>
  )
}
