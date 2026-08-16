import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../../hooks/useUserData'
import { BottlePickerModal } from '../pourWizard/BottlePickerModal'
import { PourTypeModal, type PourType } from './PourTypeModal'
import { useBottlePourFlow } from './useBottlePourFlow'

interface PourHub {
  /** Opens the Pour hub — the pour-type chooser (Quick Pour / Pour Story / Blind Room / Compare). */
  open: () => void
  /** Render this wherever the caller's tree can host a modal — renders nothing until `open()` is called. */
  modal: ReactNode
}

// The single "which kind of pour, then which bottle" workflow, shared by
// every entry point that doesn't already know the bottle: Home's "Start a
// Pour" button and the bottom/top nav's "Pour" action both call this so
// there's exactly one Pour hub, not two independently maintained ones.
export function usePourHub(): PourHub {
  const navigate = useNavigate()
  const { userDoc } = useUserData()
  const [pourTypeOpen, setPourTypeOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingType, setPendingType] = useState<'quick' | 'story' | 'compare' | null>(null)
  const [chosenBottleId, setChosenBottleId] = useState<string | null>(null)

  const pourableBottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')
  const { openFlow, modals } = useBottlePourFlow(chosenBottleId)

  function open() {
    setPourTypeOpen(true)
  }

  function handlePourType(type: PourType) {
    setPourTypeOpen(false)
    if (type === 'blind') {
      navigate('/blind/new')
      return
    }
    setPendingType(type)
    setPickerOpen(true)
  }

  function handleBottlePicked(id: string) {
    setChosenBottleId(id)
    setPickerOpen(false)
    if (pendingType === 'compare') {
      navigate(`/collection/${id}`, { state: { initialTab: 'compare' } })
    } else if (pendingType === 'quick' || pendingType === 'story') {
      openFlow(pendingType)
    }
    setPendingType(null)
  }

  const modal = (
    <>
      {pourTypeOpen ? <PourTypeModal onPick={handlePourType} onClose={() => setPourTypeOpen(false)} /> : null}

      {pickerOpen ? (
        <BottlePickerModal
          bottles={pourableBottles}
          pours={userDoc.pours}
          onClose={() => setPickerOpen(false)}
          onPick={handleBottlePicked}
        />
      ) : null}

      {modals}
    </>
  )

  return { open, modal }
}
