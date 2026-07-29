import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'

// Full spec (greeting, Continue Pour Story, Recent bottles/stories, Recommendations)
// lands in Phase 1 — this is the Phase 0 routing/shell placeholder.
export function HomePage() {
  return (
    <>
      <PageHeader eyebrow="Home" title="Good evening." subtitle="Drink what you enjoy. Share what matters." />
      <EmptyState
        title="Your whiskey journey starts here."
        message="Add a bottle to begin building your collection."
        action={<Button>Add a Bottle</Button>}
      />
    </>
  )
}
