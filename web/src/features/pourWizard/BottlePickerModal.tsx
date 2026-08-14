import { useState } from 'react'
import { Modal } from '../../components/ui/Modal'
import { Field, controlClassName } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { EmptyState } from '../../components/ui/EmptyState'
import type { Bottle } from '../../data/types'

interface BottlePickerModalProps {
  bottles: Bottle[]
  onPick: (bottleId: string) => void
  onClose: () => void
}

// Shared by StartPourStoryButton and QuickPourButton — both need to ask
// "which bottle?" before opening their respective flow when no bottleId is
// already known from context (Home/Journal vs. Bottle Details).
export function BottlePickerModal({ bottles, onPick, onClose }: BottlePickerModalProps) {
  const [pickedBottleId, setPickedBottleId] = useState('')

  return (
    <Modal title="Which bottle?" onClose={onClose}>
      {bottles.length === 0 ? (
        <EmptyState title="No bottles to pour yet." message="Add a bottle to your bar first." />
      ) : (
        <>
          <Field label="Bottle" htmlFor="bottle-picker-bottle">
            <select
              id="bottle-picker-bottle"
              className={controlClassName}
              value={pickedBottleId}
              onChange={(e) => setPickedBottleId(e.target.value)}
            >
              <option value="">Choose a bottle…</option>
              {bottles.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                  {b.distillery ? ` — ${b.distillery}` : ''}
                </option>
              ))}
            </select>
          </Field>
          <Button disabled={!pickedBottleId} onClick={() => onPick(pickedBottleId)}>
            Continue
          </Button>
        </>
      )}
    </Modal>
  )
}
