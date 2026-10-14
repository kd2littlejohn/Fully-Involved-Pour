import type { FipGuide } from '../../../data/repositories/fipGuide'
import type { FipGuideLoadState } from '../../../features/bottleDetails/useFipGuide'
import { FipGuideSection } from '../../../features/bottleDetails/FipGuideSection'
import { EmptyState } from '../../../components/ui/EmptyState'

// The existing FIP Guide (story, what makes it special, what to expect,
// buy if / pass if, verdict). When the bottle isn't confidently recognized
// there is no guide, and the tab says so rather than inventing one.
export function GuideTab({ state, guide }: { state: FipGuideLoadState; guide: FipGuide | undefined }) {
  if (state === 'none' || (state === 'ready' && !guide)) {
    return <EmptyState title="No FIP Guide for this bottle yet." message="Guides only appear when FIP can identify a bottle confidently." />
  }
  return <FipGuideSection state={state} guide={guide} part="guide" />
}
