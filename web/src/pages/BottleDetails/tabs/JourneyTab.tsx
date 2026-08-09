import { useState } from 'react'
import type { Bottle, Pour } from '../../../data/types'
import { buildJourneyEvents } from '../../../features/bottleDetails/selectors'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Timeline, type TimelineEvent } from '../../../components/domain/Timeline'
import { PourStoryDetail } from '../../../features/pourWizard/PourStoryDetail'

export function JourneyTab({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const events = buildJourneyEvents(bottle, pours)
  const [selectedPour, setSelectedPour] = useState<Pour | null>(null)

  if (events.length === 0) {
    return <EmptyState title="This bottle's journey is just beginning." message="Its story will build as you log pours over time." />
  }

  function handleEventClick(event: TimelineEvent) {
    const pour = pours.find((p) => p.id === event.pourId)
    if (pour) setSelectedPour(pour)
  }

  return (
    <>
      <Timeline events={events} onEventClick={handleEventClick} />
      {selectedPour ? <PourStoryDetail pour={selectedPour} bottle={bottle} onClose={() => setSelectedPour(null)} /> : null}
    </>
  )
}
