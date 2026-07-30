import { useState } from 'react'
import type { Memory } from '../../data/types'
import { Modal } from '../../components/ui/Modal'
import { Button } from '../../components/ui/Button'
import { useUserData } from '../../hooks/useUserData'
import { MemoryForm } from './MemoryForm'
import styles from './MemoryDetail.module.css'

interface MemoryDetailProps {
  memory: Memory
  bottleName?: string
  onClose: () => void
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export function MemoryDetail({ memory, bottleName, onClose }: MemoryDetailProps) {
  const [editing, setEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { userDoc, updateMemory, deleteMemory } = useUserData()

  async function handleDelete() {
    setDeleting(true)
    await deleteMemory(memory.id)
    setDeleting(false)
    onClose()
  }

  if (editing) {
    return (
      <Modal title="Edit Memory" onClose={onClose}>
        <MemoryForm
          bottles={userDoc.bottles}
          initial={memory}
          onCancel={() => setEditing(false)}
          onSubmit={async (input) => {
            await updateMemory(memory.id, input)
            onClose()
          }}
        />
      </Modal>
    )
  }

  const metaParts = [dateFormatter.format(new Date(memory.date)), memory.occasion, memory.location, bottleName].filter(Boolean)

  return (
    <Modal title={memory.title} onClose={onClose}>
      {memory.photoUrl ? (
        <div className={styles.photoWrap}>
          <img className={styles.photo} src={memory.photoUrl} alt="" />
        </div>
      ) : null}

      <div className={styles.meta}>
        {metaParts.join(' · ')}
        {memory.people.length > 0 ? <div>With {memory.people.join(', ')}</div> : null}
      </div>

      <p className={styles.story}>{memory.story}</p>

      <div className={styles.actions}>
        {confirmingDelete ? (
          <div className={styles.confirm}>
            <span className={styles.confirmText}>Delete this memory?</span>
            <Button variant="ghost" onClick={() => setConfirmingDelete(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="secondary" onClick={handleDelete} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Confirm Delete'}
            </Button>
          </div>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </>
        )}
      </div>
    </Modal>
  )
}
