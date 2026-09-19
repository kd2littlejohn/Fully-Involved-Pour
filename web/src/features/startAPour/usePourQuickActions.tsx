import { useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useUserData } from '../../hooks/useUserData'
import { BottlePickerModal } from '../pourWizard/BottlePickerModal'
import { QuickPour } from '../quickPour/QuickPour'
import { currentBatch } from '../infinityBottle/selectors'
import { PourQuickActionSheet, type PourQuickAction } from './PourQuickActionSheet'

interface PourQuickActions {
  /** Opens the center-nav quick-action sheet (Record a Pour / Blind / Add Bottle / Update Open Bottle / Infinity Bottle). */
  open: () => void
  /** Render this wherever the caller's tree can host a modal — renders nothing until `open()` is called. */
  modal: ReactNode
}

// The bottom/top nav's own Pour entry point — deliberately separate from
// usePourHub (which is "which kind of pour, for a not-yet-chosen bottle",
// shared by StartAPourButton elsewhere). This hub is one level up: it's
// every quick action reachable without already being on a bottle-specific
// screen, of which "Record a Pour" is only one. Record a Pour itself opens
// straight into QuickPour (skipping the Quick Pour/Pour Story choice) since
// QuickPour already offers "Tell the Full Story" to reach the full wizard —
// one fast unified pour flow, not a second type-chooser nested inside this one.
export function usePourQuickActions(): PourQuickActions {
  const navigate = useNavigate()
  const { userDoc } = useUserData()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [picking, setPicking] = useState<'record' | 'update' | null>(null)
  const [activePour, setActivePour] = useState<{ id: string; name: string } | null>(null)

  const pourableBottles = userDoc.bottles.filter((b) => b.status === 'open' || b.status === 'sealed')
  const openBottles = userDoc.bottles.filter((b) => b.status === 'open')
  const activeInfinityBatches = userDoc.infinityBottles.map((ib) => ({ ib, batch: currentBatch(ib) })).filter((x) => x.batch)

  function open() {
    setSheetOpen(true)
  }

  function handleAction(action: PourQuickAction) {
    setSheetOpen(false)
    switch (action) {
      case 'record':
        setPicking('record')
        break
      case 'blind':
        navigate('/blind/new')
        break
      case 'add-bottle':
        navigate('/bottles/new')
        break
      case 'update-open':
        setPicking('update')
        break
      case 'infinity':
        if (activeInfinityBatches.length === 1) {
          navigate(`/collection/infinity/${activeInfinityBatches[0]!.batch!.id}/add`)
        } else {
          navigate('/collection/infinity')
        }
        break
    }
  }

  function handleBottlePicked(bottleId: string) {
    if (picking === 'update') {
      setPicking(null)
      navigate(`/bottles/${bottleId}/edit`)
      return
    }
    const bottle = userDoc.bottles.find((b) => b.id === bottleId)
    setPicking(null)
    if (bottle) setActivePour({ id: bottle.id, name: bottle.name })
  }

  const modal = (
    <>
      {sheetOpen ? (
        <PourQuickActionSheet
          canRecordPour={pourableBottles.length > 0}
          canUpdateOpenBottle={openBottles.length > 0}
          canAddToInfinityBottle={activeInfinityBatches.length > 0}
          onPick={handleAction}
          onClose={() => setSheetOpen(false)}
        />
      ) : null}

      {picking === 'record' ? (
        <BottlePickerModal bottles={pourableBottles} pours={userDoc.pours} onPick={handleBottlePicked} onClose={() => setPicking(null)} />
      ) : null}

      {picking === 'update' ? (
        <BottlePickerModal bottles={openBottles} onPick={handleBottlePicked} onClose={() => setPicking(null)} />
      ) : null}

      {activePour ? (
        <QuickPour bottleId={activePour.id} bottleName={activePour.name} onClose={() => setActivePour(null)} />
      ) : null}
    </>
  )

  return { open, modal }
}
