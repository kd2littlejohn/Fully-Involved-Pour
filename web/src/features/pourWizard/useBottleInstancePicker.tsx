import { useState } from 'react'
import type { Bottle } from '../../data/types'
import { instanceLabel, openInstances } from '../bottleInstances/selectors'
import { Modal } from '../../components/ui/Modal'
import styles from './BottleInstancePicker.module.css'

// Shared by QuickPour and PourWizard — resolves which physical bottle a
// pour is coming from before the pour is actually saved. The common case
// (no instances, or exactly one open) resolves synchronously with no UI at
// all; only when more than one instance is genuinely open does this ask.
export function useBottleInstancePicker(bottle: Bottle | undefined) {
  const [pendingResolve, setPendingResolve] = useState<((instanceId: string | undefined) => void) | null>(null)

  const candidates = bottle?.instances ? openInstances(bottle.instances) : []

  // Call this instead of saving directly. `onResolved` fires with the
  // instance id to stamp on the pour (or undefined for a plain bottle, or a
  // bottle with no open instances) — synchronously in the common case, or
  // once the user picks from the modal below when it's genuinely ambiguous.
  function resolveThenSave(onResolved: (instanceId: string | undefined) => void) {
    if (candidates.length <= 1) {
      onResolved(candidates[0]?.id)
      return
    }
    setPendingResolve(() => onResolved)
  }

  const picker =
    pendingResolve && bottle?.instances ? (
      <Modal title="Which bottle are you pouring from?" onClose={() => setPendingResolve(null)}>
        <div className={styles.list}>
          {candidates.map((instance) => (
            <button
              key={instance.id}
              type="button"
              className={styles.row}
              onClick={() => {
                pendingResolve(instance.id)
                setPendingResolve(null)
              }}
            >
              {instanceLabel(instance, bottle.instances!.indexOf(instance))}
            </button>
          ))}
        </div>
      </Modal>
    ) : null

  return { resolveThenSave, picker }
}
