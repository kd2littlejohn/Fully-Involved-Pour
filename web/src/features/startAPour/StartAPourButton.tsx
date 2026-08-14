import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { BottlePickerModal } from '../pourWizard/BottlePickerModal'
import { useBottlePourFlow } from './useBottlePourFlow'

interface StartAPourButtonProps {
  bottleId?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

// Unified "Start a Pour" entry point: Step 1 picks a bottle (skipped when
// bottleId is already known, e.g. from Bottle Details), Step 2 picks a pour
// type, then routes into the matching flow (see useBottlePourFlow).
export function StartAPourButton({ bottleId, label = 'Start a Pour', variant = 'primary' }: StartAPourButtonProps) {
  const { userDoc } = useUserData()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [chosenBottleId, setChosenBottleId] = useState<string | null>(null)

  const pourableBottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')
  const activeBottleId = bottleId ?? chosenBottleId
  const { open: openPourFlow, modals } = useBottlePourFlow(activeBottleId)

  function handleClick() {
    if (bottleId) {
      openPourFlow()
    } else {
      setPickerOpen(true)
    }
  }

  function handleBottlePicked(id: string) {
    setChosenBottleId(id)
    setPickerOpen(false)
    openPourFlow()
  }

  return (
    <>
      <Button variant={variant} onClick={handleClick}>
        {label}
      </Button>

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
