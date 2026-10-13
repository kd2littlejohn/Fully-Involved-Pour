import { Button } from '../../components/ui/Button'
import { useBottlePourFlow } from './useBottlePourFlow'
import { usePourHub } from './usePourHub'

interface StartAPourButtonProps {
  bottleId?: string
  label?: string
  variant?: 'primary' | 'secondary' | 'ghost'
  className?: string
}

// Unified "Start a Pour" entry point. When bottleId is already known (e.g.
// from Bottle Details), it's a one-step pour-type chooser (useBottlePourFlow).
// Otherwise it opens the shared Pour hub (usePourHub) — the same hub the
// bottom/top nav's "Pour" action opens, so there's exactly one Pour workflow.
export function StartAPourButton({ bottleId, label = 'Start a Pour', variant = 'primary', className }: StartAPourButtonProps) {
  const bottleFlow = useBottlePourFlow(bottleId ?? null)
  const hub = usePourHub()

  function handleClick() {
    if (bottleId) {
      bottleFlow.open()
    } else {
      hub.open()
    }
  }

  return (
    <>
      <Button variant={variant} className={className} onClick={handleClick}>
        {label}
      </Button>

      {bottleId ? bottleFlow.modals : hub.modal}
    </>
  )
}
