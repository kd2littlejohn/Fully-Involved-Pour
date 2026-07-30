import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { useUserData } from '../../hooks/useUserData'
import { PourWizard } from './PourWizard'

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
  const [pickedBottleId, setPickedBottleId] = useState('')
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
        <Modal title="Which bottle?" onClose={() => setPickerOpen(false)}>
          {pourableBottles.length === 0 ? (
            <EmptyState title="No bottles to pour yet." message="Add a bottle to your collection first." />
          ) : (
            <>
              <Field label="Bottle" htmlFor="pw-picker-bottle">
                <select
                  id="pw-picker-bottle"
                  className={controlClassName}
                  value={pickedBottleId}
                  onChange={(e) => setPickedBottleId(e.target.value)}
                >
                  <option value="">Choose a bottle…</option>
                  {pourableBottles.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.distillery ? ` — ${b.distillery}` : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Button
                disabled={!pickedBottleId}
                onClick={() => {
                  setWizardBottleId(pickedBottleId)
                  setPickerOpen(false)
                }}
              >
                Continue
              </Button>
            </>
          )}
        </Modal>
      ) : null}

      {wizardBottle ? (
        <PourWizard bottleId={wizardBottle.id} bottleName={wizardBottle.name} onClose={() => setWizardBottleId(null)} />
      ) : null}
    </>
  )
}
