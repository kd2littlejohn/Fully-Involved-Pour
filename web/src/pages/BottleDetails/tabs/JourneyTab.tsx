import type { Bottle, Pour } from '../../../data/types'
import { buildJourneyEvents } from '../../../features/bottleDetails/selectors'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Timeline } from '../../../components/domain/Timeline'

export function JourneyTab({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const events = buildJourneyEvents(bottle, pours)

  if (events.length === 0) {
    return <EmptyState title="This bottle's journey is just beginning." message="Its story will build as you log pours over time." />
  }

  return <Timeline events={events} />
}
