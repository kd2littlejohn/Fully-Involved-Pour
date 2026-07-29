import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'

export function JournalPage() {
  return (
    <>
      <PageHeader eyebrow="Journal" title="Your Pour Stories." subtitle="Capture and revisit your whiskey experiences." />
      <EmptyState
        title="Your first Pour Story starts here."
        message="Open a bottle, capture the pour, and begin your whiskey journey."
        action={<Button>Start a Pour Story</Button>}
      />
    </>
  )
}
