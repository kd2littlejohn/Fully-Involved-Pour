import { PageHeader } from '../../components/layout/PageHeader'
import { Section, SectionRow } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { BottleCard } from '../../components/domain/BottleCard'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { getWishlistBottles, getTopRatedBottles, getDistilleryStats } from '../../features/discover/selectors'
import { AddToWishlistButton } from '../../features/discover/AddToWishlistButton'
import { AiRecommendations } from '../../features/discover/AiRecommendations'
import { DistilleryList } from '../../features/discover/DistilleryList'

export function DiscoverPage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Discover" title="What to try next." />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Discover" title="What to try next." subtitle="Recommendations, new releases, and trending bottles." />
        <EmptyState
          title="Recommendations start with your collection."
          message="Sign in to see what to try next."
          action={<SignInButton />}
        />
      </>
    )
  }

  const { bottles, pours } = userDoc

  if (bottles.length === 0) {
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

  const wishlistBottles = getWishlistBottles(bottles)
  const topRated = getTopRatedBottles(bottles, pours)
  const distilleries = getDistilleryStats(bottles)

  return (
    <>
      <PageHeader eyebrow="Discover" title="What to try next." subtitle="Recommendations, new releases, and trending bottles." />

      <Section title="Buy Next">
        {wishlistBottles.length === 0 ? (
          <EmptyState
            title="Your wishlist is empty."
            message="Add a bottle you want to try next."
            action={<AddToWishlistButton />}
          />
        ) : (
          <>
            <SectionRow>
              {wishlistBottles.map((bottle) => (
                <BottleCard key={bottle.id} bottle={bottle} />
              ))}
            </SectionRow>
            <AddToWishlistButton />
          </>
        )}
      </Section>

      <Section title="Top Rated">
        {topRated.length === 0 ? (
          <EmptyState title="No ratings yet." message="Log a Pour Story to start ranking your favorites." />
        ) : (
          <SectionRow>
            {topRated.map(({ bottle }) => (
              <BottleCard key={bottle.id} bottle={bottle} />
            ))}
          </SectionRow>
        )}
      </Section>

      <Section title="Your Distilleries">
        {distilleries.length === 0 ? (
          <EmptyState title="No distilleries yet." message="Add a bottle's distillery to see this build up over time." />
        ) : (
          <DistilleryList distilleries={distilleries} />
        )}
      </Section>

      <Section title="Recommended for You">
        <AiRecommendations />
      </Section>

      <Section title="New Releases">
        <EmptyState
          title="Not available yet."
          message="Surfacing real new releases needs a whiskey release database we haven't connected yet."
        />
      </Section>

      <Section title="Trending">
        <EmptyState
          title="Not available yet."
          message="Trending needs real activity from other users, which isn't wired up yet."
        />
      </Section>

      <Section title="Nearby Stores">
        <EmptyState
          title="Not available yet."
          message="Finding stores near you needs a location and retailer data source we haven't connected yet."
        />
      </Section>
    </>
  )
}
