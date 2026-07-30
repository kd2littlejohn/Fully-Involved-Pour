import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { useUserData } from '../../hooks/useUserData'
import { MemoryForm } from './MemoryForm'

export function CreateMemoryButton() {
  const [open, setOpen] = useState(false)
  const { userDoc, addMemory } = useUserData()

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Create a Memory
      </Button>

      {open ? (
        <Modal title="Create a Memory" onClose={() => setOpen(false)}>
          <MemoryForm
            bottles={userDoc.bottles}
            onCancel={() => setOpen(false)}
            onSubmit={async (input) => {
              await addMemory(input)
              setOpen(false)
            }}
          />
        </Modal>
      ) : null}
    </>
  )
}
