import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { EmptyState } from '../../components/ui/EmptyState'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { StartPourStoryButton } from '../pourWizard/StartPourStoryButton'
import { useUserData } from '../../hooks/useUserData'
import { DiceFace } from './DiceFace'
import type { Bottle } from '../../data/types'
import styles from './RollTheDiceButton.module.css'

const FACES = [1, 2, 3, 4, 5, 6]
const ROLL_DURATION_MS = 900
const ROLL_TICK_MS = 90

export function RollTheDiceButton() {
  const { userDoc } = useUserData()
  const [open, setOpen] = useState(false)
  const [dieValue, setDieValue] = useState(1)
  const [rolling, setRolling] = useState(false)
  const [pickedBottle, setPickedBottle] = useState<Bottle | undefined>(undefined)
  const rollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const pourable = userDoc.bottles.filter((b) => b.status === 'open' || b.status === 'sealed')

  // The die face is just for show — the bottle itself is always an
  // independent random draw, never tied to whichever number comes up.
  function drawRandomBottle(): Bottle | undefined {
    if (pourable.length === 0) return undefined
    return pourable[Math.floor(Math.random() * pourable.length)]
  }

  useEffect(() => {
    return () => {
      if (rollTimer.current) clearInterval(rollTimer.current)
    }
  }, [])

  function reset() {
    setPickedBottle(undefined)
    setRolling(false)
    if (rollTimer.current) clearInterval(rollTimer.current)
  }

  function handleOpen() {
    reset()
    setOpen(true)
  }

  function handleRoll() {
    if (rolling) return
    setPickedBottle(undefined)
    setRolling(true)
    const startedAt = Date.now()
    rollTimer.current = setInterval(() => {
      setDieValue(FACES[Math.floor(Math.random() * FACES.length)] ?? 1)
      if (Date.now() - startedAt >= ROLL_DURATION_MS) {
        if (rollTimer.current) clearInterval(rollTimer.current)
        setRolling(false)
        setPickedBottle(drawRandomBottle())
      }
    }, ROLL_TICK_MS)
  }

  function handlePick(n: number) {
    if (rolling) return
    reset()
    setDieValue(n)
    setPickedBottle(drawRandomBottle())
  }

  return (
    <>
      <Button variant="secondary" onClick={handleOpen}>
        🎲 Roll the Dice
      </Button>

      {open ? (
        <Modal
          title="Tonight's Pour"
          onClose={() => {
            setOpen(false)
            reset()
          }}
        >
          {pourable.length === 0 ? (
            <EmptyState title="Nothing to roll yet." message="Add a sealed or opened bottle to your collection first." />
          ) : (
            <div className={styles.wrap}>
              <DiceFace value={dieValue} size={96} rolling={rolling} />

              <div className={styles.pickRow}>
                <span className={styles.pickLabel}>Or choose a number</span>
                <div className={styles.pickButtons}>
                  {FACES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={styles.pickButton}
                      onClick={() => handlePick(n)}
                      disabled={rolling}
                      aria-label={`Choose ${n}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {!pickedBottle ? (
                <Button onClick={handleRoll} disabled={rolling}>
                  {rolling ? 'Rolling…' : 'Roll the Dice'}
                </Button>
              ) : pickedBottle ? (
                <div className={styles.result}>
                  <div className={styles.imageWrap}>
                    {pickedBottle.imageUrl ? (
                      <img className={styles.image} src={pickedBottle.imageUrl} alt="" />
                    ) : (
                      <BottlePlaceholder name={pickedBottle.name} />
                    )}
                  </div>
                  <div className={styles.name}>{pickedBottle.name}</div>
                  {pickedBottle.distillery ? <div className={styles.distillery}>{pickedBottle.distillery}</div> : null}
                  <div className={styles.actions}>
                    <Button variant="ghost" onClick={handleRoll}>
                      Roll Again
                    </Button>
                    <StartPourStoryButton bottleId={pickedBottle.id} label="Start a Pour Story" />
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </Modal>
      ) : null}
    </>
  )
}
