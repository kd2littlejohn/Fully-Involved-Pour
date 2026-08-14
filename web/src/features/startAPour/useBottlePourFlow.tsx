import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../../hooks/useUserData'
import { PourWizard } from '../pourWizard/PourWizard'
import { QuickPour } from '../quickPour/QuickPour'
import { PourTypeModal, type PourType } from './PourTypeModal'

interface BottlePourFlow {
  /** Opens the pour-type chooser (Quick Pour / Pour Story / Comparison) for the current bottleId. */
  open: () => void
  /** Render this wherever the caller's tree can host a modal — renders nothing until `open()` is called. */
  modals: ReactNode
}

// The "Step 2 onward" half of StartAPourButton (pour-type chooser -> Quick
// Pour / Pour Wizard / Compare tab), factored out so any bottleId-scoped
// trigger — the button's own click, or a contextual menu item elsewhere
// (e.g. a My Bar card) — can launch the exact same flow without duplicating
// it. `bottleId` may be null while a caller hasn't resolved one yet (e.g.
// StartAPourButton's own bottle-picker step); `open()` is safe to call
// regardless, since it's the caller's job to only call it once a real
// bottleId is in play.
export function useBottlePourFlow(bottleId: string | null): BottlePourFlow {
  const navigate = useNavigate()
  const { userDoc } = useUserData()
  const [pourTypeOpen, setPourTypeOpen] = useState(false)
  const [activeFlow, setActiveFlow] = useState<'quick' | 'story' | null>(null)

  const bottle = bottleId ? userDoc.bottles.find((b) => b.id === bottleId) : undefined

  function open() {
    setPourTypeOpen(true)
  }

  function handlePourTypeClose() {
    setPourTypeOpen(false)
  }

  function handlePourType(type: PourType) {
    setPourTypeOpen(false)
    if (type === 'compare') {
      if (bottleId) navigate(`/collection/${bottleId}`, { state: { initialTab: 'compare' } })
      return
    }
    setActiveFlow(type)
  }

  function handleFlowClose() {
    setActiveFlow(null)
  }

  const modals = bottle ? (
    <>
      {pourTypeOpen ? <PourTypeModal bottleName={bottle.name} onPick={handlePourType} onClose={handlePourTypeClose} /> : null}
      {activeFlow === 'quick' ? <QuickPour bottleId={bottle.id} bottleName={bottle.name} onClose={handleFlowClose} /> : null}
      {activeFlow === 'story' ? <PourWizard bottleId={bottle.id} bottleName={bottle.name} onClose={handleFlowClose} /> : null}
    </>
  ) : null

  return { open, modals }
}
