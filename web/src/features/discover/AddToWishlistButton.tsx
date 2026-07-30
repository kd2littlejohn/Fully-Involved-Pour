import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { AddBottleForm } from '../../components/domain/AddBottleForm'
import { useUserData } from '../../hooks/useUserData'

export function AddToWishlistButton() {
  const [open, setOpen] = useState(false)
  const { addBottle } = useUserData()

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add to Wishlist</Button>

      {open ? (
        <Modal title="Add to Wishlist" onClose={() => setOpen(false)}>
          <AddBottleForm
            defaultStatus="wishlist"
            onCancel={() => setOpen(false)}
            onSubmit={async (input) => {
              await addBottle(input)
              setOpen(false)
            }}
          />
        </Modal>
      ) : null}
    </>
  )
}
