import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { PourWizard } from './PourWizard'
import { BottlePickerModal } from './BottlePickerModal'

interface StartPourStoryButtonProps {
  bottleId?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

// When a bottleId is known (Bottle Details), the wizard opens directly.
// Otherwise (Home, Journal) a lightweight picker asks which bottle first —
// you can't pour a bottle you haven't acquired, so wishlist items are excluded.
export function StartPourStoryButton({ bottleId, label = 'Start a Pour Story', variant }: StartPourStoryButtonProps) {
  const { userDoc } = useUserData()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [wizardBottleId, setWizardBottleId] = useState<string | null>(null)

  const pourableBottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')

  function handleClick() {
    if (bottleId) {
      setWizardBottleId(bottleId)
    } else {
      setPickerOpen(true)
    }
  }

  const wizardBottle = userDoc.bottles.find((b) => b.id === wizardBottleId)

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
          onPick={(id) => {
            setWizardBottleId(id)
            setPickerOpen(false)
          }}
        />
      ) : null}

      {wizardBottle ? (
        <PourWizard bottleId={wizardBottle.id} bottleName={wizardBottle.name} onClose={() => setWizardBottleId(null)} />
      ) : null}
    </>
  )
}
