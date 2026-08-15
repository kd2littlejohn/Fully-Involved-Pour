import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { BottlePickerModal } from '../pourWizard/BottlePickerModal'
import { PourTypeModal, type PourType } from './PourTypeModal'
import { useBottlePourFlow } from './useBottlePourFlow'

interface StartAPourButtonProps {
  bottleId?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

// Unified "Start a Pour" entry point. When bottleId is already known (e.g.
// from Bottle Details), it's a one-step pour-type chooser. Otherwise pour
// type comes first: Blind Room builds its own flight and skips bottle
// picking entirely, while Quick Pour/Pour Story/Comparison then ask "which
// bottle?" before routing into the matching flow (see useBottlePourFlow).
export function StartAPourButton({ bottleId, label = 'Start a Pour', variant = 'primary' }: StartAPourButtonProps) {
  const navigate = useNavigate()
  const { userDoc } = useUserData()
  const [pourTypeOpen, setPourTypeOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pendingType, setPendingType] = useState<'quick' | 'story' | 'compare' | null>(null)
  const [chosenBottleId, setChosenBottleId] = useState<string | null>(null)

  const pourableBottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')
  const activeBottleId = bottleId ?? chosenBottleId
  const { open: openPourFlow, openFlow, modals } = useBottlePourFlow(activeBottleId)

  function handleClick() {
    if (bottleId) {
      openPourFlow()
    } else {
      setPourTypeOpen(true)
    }
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

  return (
    <>
      <Button variant={variant} onClick={handleClick}>
        {label}
      </Button>

      {pourTypeOpen ? (
        <PourTypeModal onPick={handlePourType} onClose={() => setPourTypeOpen(false)} />
      ) : null}

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
}
