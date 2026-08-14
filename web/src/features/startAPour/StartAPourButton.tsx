import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { BottlePickerModal } from '../pourWizard/BottlePickerModal'
import { PourWizard } from '../pourWizard/PourWizard'
import { QuickPour } from '../quickPour/QuickPour'
import { PourTypeModal, type PourType } from './PourTypeModal'

interface StartAPourButtonProps {
  bottleId?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

// Unified "Start a Pour" entry point: Step 1 picks a bottle (skipped when
// bottleId is already known, e.g. from Bottle Details), Step 2 picks a pour
// type, then routes into the matching flow. Comparison reuses the existing
// Compare tab rather than a new comparison-logging feature.
export function StartAPourButton({ bottleId, label = 'Start a Pour', variant = 'primary' }: StartAPourButtonProps) {
  const navigate = useNavigate()
  const { userDoc } = useUserData()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [chosenBottleId, setChosenBottleId] = useState<string | null>(null)
  const [pourTypeOpen, setPourTypeOpen] = useState(false)
  const [activeFlow, setActiveFlow] = useState<'quick' | 'story' | null>(null)

  const pourableBottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')
  const chosenBottle = userDoc.bottles.find((b) => b.id === chosenBottleId)

  function handleClick() {
    if (bottleId) {
      setChosenBottleId(bottleId)
      setPourTypeOpen(true)
    } else {
      setPickerOpen(true)
    }
  }

  function handleBottlePicked(id: string) {
    setChosenBottleId(id)
    setPickerOpen(false)
    setPourTypeOpen(true)
  }

  function handlePourTypeClose() {
    setPourTypeOpen(false)
    setChosenBottleId(null)
  }

  function handlePourType(type: PourType) {
    setPourTypeOpen(false)
    if (type === 'compare') {
      if (chosenBottleId) navigate(`/collection/${chosenBottleId}`, { state: { initialTab: 'compare' } })
      setChosenBottleId(null)
      return
    }
    setActiveFlow(type)
  }

  function handleFlowClose() {
    setActiveFlow(null)
    setChosenBottleId(null)
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

      {pourTypeOpen && chosenBottle ? (
        <PourTypeModal bottleName={chosenBottle.name} onPick={handlePourType} onClose={handlePourTypeClose} />
      ) : null}

      {activeFlow === 'quick' && chosenBottle ? (
        <QuickPour bottleId={chosenBottle.id} bottleName={chosenBottle.name} onClose={handleFlowClose} />
      ) : null}

      {activeFlow === 'story' && chosenBottle ? (
        <PourWizard bottleId={chosenBottle.id} bottleName={chosenBottle.name} onClose={handleFlowClose} />
      ) : null}
    </>
  )
}
