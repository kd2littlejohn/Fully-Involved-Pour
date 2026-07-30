import type { Bottle, Pour } from '../../../data/types'
import { getPoursForBottle } from '../../../features/bottleDetails/selectors'
import { PourStoryCard } from '../../../components/domain/PourStoryCard'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Section, SectionRow } from '../../../components/layout/Section'
import { StartPourStoryButton } from '../../../features/pourWizard/StartPourStoryButton'

export function PourStoriesTab({ bottle, pours }: { bottle: Bottle; pours: Pour[] }) {
  const bottlePours = getPoursForBottle(pours, bottle.id)

  if (bottlePours.length === 0) {
    return (
      <EmptyState
        title="Your first Pour Story starts here."
        message="Open a bottle, capture the pour, and begin your whiskey journey."
        action={<StartPourStoryButton bottleId={bottle.id} />}
      />
    )
  }

  return (
    <Section title={`${bottlePours.length} Pour ${bottlePours.length === 1 ? 'Story' : 'Stories'}`}>
      <SectionRow>
        {bottlePours.map((pour) => (
          <PourStoryCard key={pour.id} pour={pour} bottle={bottle} />
        ))}
      </SectionRow>
      <StartPourStoryButton bottleId={bottle.id} label="+ Add Story" variant="secondary" />
    </Section>
  )
}
