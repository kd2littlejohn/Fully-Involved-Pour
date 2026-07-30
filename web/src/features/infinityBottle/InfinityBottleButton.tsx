import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { Field, controlClassName } from '../../components/ui/Field'
import { EmptyState } from '../../components/ui/EmptyState'
import { useUserData } from '../../hooks/useUserData'
import styles from './InfinityBottleButton.module.css'

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function InfinityBottleButton() {
  const [open, setOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [additionBottleId, setAdditionBottleId] = useState('')
  const [additionAmount, setAdditionAmount] = useState('')
  const { userDoc, createInfinityBottle, addInfinityAddition } = useUserData()

  const infinityBottle = userDoc.infinityBottles[0]

  async function handleCreate() {
    await createInfinityBottle(newName.trim() || 'My Infinity Bottle')
    setNewName('')
  }

  async function handleAddAddition() {
    if (!infinityBottle || !additionBottleId) return
    const bottle = userDoc.bottles.find((b) => b.id === additionBottleId)
    if (!bottle) return
    await addInfinityAddition(infinityBottle.id, {
      bottleId: bottle.id,
      name: bottle.name,
      amount: additionAmount.trim() || undefined,
      date: new Date().toISOString().slice(0, 10),
    })
    setAdditionBottleId('')
    setAdditionAmount('')
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Infinity Bottle
      </Button>

      {open ? (
        <Modal title={infinityBottle?.name ?? 'Infinity Bottle'} onClose={() => setOpen(false)}>
          {!infinityBottle ? (
            <>
              <EmptyState
                title="Start your Infinity Bottle."
                message="A perpetual blend built one pour's leftovers at a time."
              />
              <Field label="Name" htmlFor="infinity-name">
                <input
                  id="infinity-name"
                  className={controlClassName}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My Infinity Bottle"
                />
              </Field>
              <Button onClick={handleCreate}>Create Infinity Bottle</Button>
            </>
          ) : (
            <>
              {infinityBottle.additions.length === 0 ? (
                <EmptyState title="No additions yet." message="Add a splash from a bottle you're finishing." />
              ) : (
                <div>
                  {infinityBottle.additions.map((addition, index) => (
                    <div className={styles.additionRow} key={`${addition.name}-${index}`}>
                      <span className={styles.additionName}>{addition.name}</span>
                      <span className={styles.additionMeta}>
                        {addition.amount ? `${addition.amount} · ` : ''}
                        {addition.date ? dateFormatter.format(new Date(addition.date)) : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {userDoc.bottles.length > 0 ? (
                <div className={styles.formRow}>
                  <Field label="Add from bottle" htmlFor="infinity-bottle-select">
                    <select
                      id="infinity-bottle-select"
                      className={controlClassName}
                      value={additionBottleId}
                      onChange={(e) => setAdditionBottleId(e.target.value)}
                    >
                      <option value="">Choose a bottle…</option>
                      {userDoc.bottles.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount" htmlFor="infinity-amount">
                    <input
                      id="infinity-amount"
                      className={controlClassName}
                      value={additionAmount}
                      onChange={(e) => setAdditionAmount(e.target.value)}
                      placeholder="1 oz"
                    />
                  </Field>
                  <Button onClick={handleAddAddition} disabled={!additionBottleId}>
                    Add
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </Modal>
      ) : null}
    </>
  )
}
