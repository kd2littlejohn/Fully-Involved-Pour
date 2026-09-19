import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section, SectionRow } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import { WhatShouldIPourCard } from '../../features/home/WhatShouldIPourCard'
import { OpenBottleCard } from '../../features/home/OpenBottleCard'
import { ContinueYourPourStoryCard } from '../../features/home/ContinueYourPourStoryCard'
import { MaybeTonightCard } from '../../features/home/MaybeTonightCard'
import { LastBlindCard } from '../../features/home/LastBlindCard'
import { FriendsRecentPoursCard } from '../../features/home/FriendsRecentPoursCard'
import { PalateInsightCard, PalateInsightEmptyCard } from '../../features/home/PalateInsightCard'
import { CollectionSnapshot } from '../../features/home/CollectionSnapshot'
import { useLastBlindSummary } from '../../features/home/useLastBlindSummary'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import {
  getFeaturedOpenBottle,
  getMaybeTonightCandidates,
  getOpenBottles,
  getCollectionSnapshot,
  getPalateInsight,
  greetingForHour,
} from '../../features/home/selectors'
import homeHeroImage from '../../assets/home-hero.webp'
import styles from './HomePage.module.css'

// The approved hero banner — the real FIP compass mark, wordmark, and
// lounge photography, never regenerated. Rendered at its native ~3:1 ratio
// (width:100%, height:auto) so the whole thing is always visible; never
// object-fit:cover, which would crop the logo or the glass/decanter on the
// right at narrow widths.
function HomeHero() {
  return (
    <div className={styles.hero}>
      <img
        className={styles.heroImage}
        src={homeHeroImage}
        alt="Fully Involved Pour — drink what you enjoy, share what matters."
      />
    </div>
  )
}

export function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()
  const { summary: lastBlind } = useLastBlindSummary(user?.uid)

  const greeting = greetingForHour(new Date().getHours())
  const name = userDoc.greetingName || user?.displayName?.split(' ')[0]

  if (authLoading || dataLoading) {
    return (
      <>
        <HomeHero />
        <PageHeader eyebrow="Home" title={`${greeting}.`} />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <HomeHero />
        <PageHeader eyebrow="Home" title={`${greeting}.`} subtitle="Drink what you enjoy. Share what matters." />
        <EmptyState
          title="Your whiskey journey starts here."
          message="Sign in to start building your bar and capturing every pour."
          action={<SignInButton />}
        />
      </>
    )
  }

  const { bottles, pours } = userDoc
  const featuredBottle = getFeaturedOpenBottle(bottles)
  const maybeTonight = getMaybeTonightCandidates(bottles, pours)
  const openBottles = getOpenBottles(bottles, pours)
  const collectionSnapshot = getCollectionSnapshot(bottles)
  const palateInsight = getPalateInsight(bottles, pours)

  return (
    <>
      <HomeHero />
      <PageHeader
        eyebrow="Home"
        title={name ? `${greeting}, ${name}.` : `${greeting}.`}
        subtitle="What are you pouring tonight?"
      />

      {bottles.length === 0 ? (
        <EmptyState
          title="Your whiskey journey starts here."
          message="Add a bottle to begin building your bar."
          action={
            <Link to="/bottles/new">
              <Button>Add a Bottle</Button>
            </Link>
          }
        />
      ) : (
        <>
          <WhatShouldIPourCard bottles={bottles} pours={pours} />

          {maybeTonight.length > 0 ? (
            <Section title="Maybe Tonight" viewAllHref="/collection">
              <SectionRow>
                {maybeTonight.map((candidate) => (
                  <MaybeTonightCard key={candidate.bottle.id} candidate={candidate} />
                ))}
              </SectionRow>
            </Section>
          ) : null}

          {openBottles.length > 0 ? (
            <Section title="Open Bottles" viewAllHref="/collection?filter=open">
              <SectionRow>
                {openBottles.map((summary) => (
                  <OpenBottleCard key={summary.bottle.id} summary={summary} />
                ))}
              </SectionRow>
            </Section>
          ) : null}

          {featuredBottle || lastBlind ? (
            <Section title="Continue Your Journey">
              <div className={styles.journeyStack}>
                {featuredBottle ? <ContinueYourPourStoryCard bottle={featuredBottle} pours={pours} /> : null}
                {lastBlind ? <LastBlindCard summary={lastBlind} /> : null}
              </div>
            </Section>
          ) : null}

          <Section title="Friends' Recent Pours" viewAllHref="/friends">
            <FriendsRecentPoursCard />
          </Section>

          <Section title="Your Palate">
            {palateInsight ? <PalateInsightCard insight={palateInsight} /> : <PalateInsightEmptyCard />}
          </Section>

          <Section title="Collection Snapshot" viewAllHref="/collection">
            <CollectionSnapshot snapshot={collectionSnapshot} />
          </Section>
        </>
      )}
    </>
  )
}
