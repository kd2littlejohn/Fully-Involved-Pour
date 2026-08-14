import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { BottlePickerModal } from '../pourWizard/BottlePickerModal'
import { QuickPour } from './QuickPour'

interface QuickPourButtonProps {
  bottleId?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
}

// Mirrors StartPourStoryButton's bottle-resolution (direct vs. picker), but
// opens the fast QuickPour flow instead of the full wizard.
export function QuickPourButton({ bottleId, label = '⚡ Quick Pour', variant = 'ghost' }: QuickPourButtonProps) {
  const { userDoc } = useUserData()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [activeBottleId, setActiveBottleId] = useState<string | null>(null)

  const pourableBottles = userDoc.bottles.filter((b) => b.status !== 'wishlist')

  function handleClick() {
    if (bottleId) {
      setActiveBottleId(bottleId)
    } else {
      setPickerOpen(true)
    }
  }

  const activeBottle = userDoc.bottles.find((b) => b.id === activeBottleId)

  return (
    <>
      <Button variant={variant} onClick={handleClick}>
        {label}
      </Button>

      {pickerOpen ? (
        <BottlePickerModal
          bottles={pourableBottles}
          onClose={() => setPickerOpen(false)}
          onPick={(id) => {
            setActiveBottleId(id)
            setPickerOpen(false)
          }}
        />
      ) : null}

      {activeBottle ? (
        <QuickPour bottleId={activeBottle.id} bottleName={activeBottle.name} onClose={() => setActiveBottleId(null)} />
      ) : null}
    </>
  )
}
