import { useParams } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

// Overview/Pour Stories/Journey/Gallery/Compare tabs land in Phase 5.
export function BottleDetailsPage() {
  const { bottleId } = useParams()
  return (
    <>
      <PageHeader eyebrow="Bottle" title="Bottle details" />
      <EmptyState
        title="This bottle's story is still being written."
        message={`Bottle detail view for "${bottleId}" arrives in a later phase.`}
      />
    </>
  )
}
