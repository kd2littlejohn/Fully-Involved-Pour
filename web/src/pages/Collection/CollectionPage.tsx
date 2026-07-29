import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'

export function CollectionPage() {
  return (
    <>
      <PageHeader eyebrow="Collection" title="Your bottles." subtitle="Manage and explore the bottles you own." />
      <EmptyState
        title="Your whiskey journey starts here."
        message="Add a bottle to begin building your collection."
        action={<Button>Add a Bottle</Button>}
      />
    </>
  )
}
