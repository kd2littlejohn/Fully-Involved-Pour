import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'

export function DiscoverPage() {
  return (
    <>
      <PageHeader eyebrow="Discover" title="What to try next." subtitle="Recommendations, new releases, and trending bottles." />
      <EmptyState
        title="Recommendations start with your collection."
        message="Add a few bottles and we'll start suggesting what to try next."
      />
    </>
  )
}
