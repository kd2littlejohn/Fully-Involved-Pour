import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, SectionRow } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import { WhatShouldIPourCard } from '../../features/home/WhatShouldIPourCard'
import { QuickActions } from '../../features/home/QuickActions'
import { OpenBottleCard } from '../../features/home/OpenBottleCard'
import { ContinueYourPourStoryCard } from '../../features/home/ContinueYourPourStoryCard'
import { MaybeTonightCard } from '../../features/home/MaybeTonightCard'
import { LastBlindCard } from '../../features/home/LastBlindCard'
import { CollectionSnapshot } from '../../features/home/CollectionSnapshot'
import { AxeInsightCard } from '../../features/axeInsights/AxeInsightCard'
import { useLastBlindSummary } from '../../features/home/useLastBlindSummary'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import {
  getFeaturedOpenBottle,
  getMaybeTonightCandidates,
  getOpenBottles,
  getCollectionSnapshot,
  greetingForHour,
} from '../../features/home/selectors'
import homeHeroImage from '../../assets/home-hero.webp'
import styles from './HomePage.module.css'

// Cinematic hero: the approved FIP artwork (compass mark, wordmark,
// tagline, lounge photography), never regenerated or cropped. A blurred,
// darkened copy of the same image fills the full width as atmosphere and
// fades into the page, the sharp artwork sits on top with feathered edges,
// and the greeting sits inside that atmosphere. No rectangle, no hard
// edges: the same "no frame" treatment as the bottle-detail hero photo.
function HomeHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.heroStage}>
      <div className={styles.heroAtmosphere} style={{ backgroundImage: `url(${homeHeroImage})` }} aria-hidden="true" />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.hero}>
        <img
          className={styles.heroImage}
          src={homeHeroImage}
          alt="Fully Involved Pour — drink what you enjoy, share what matters."
        />
      </div>
      <div className={styles.greeting}>
        <h1 className={styles.greetingTitle}>{title}</h1>
        {subtitle ? <p className={styles.greetingSubtitle}>{subtitle}</p> : null}
      </div>
    </div>
  )
}

// Home is a personal dashboard, in this order: greeting, Tonight's Pick,
// Quick Actions, Continue Your Journey, Open Bottles, Maybe Tonight, Your
// Bar Snapshot, AXE Insight. Friends' activity lives on Friends.
export function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()
  const { summary: lastBlind } = useLastBlindSummary(user?.uid)
  const [pickedId, setPickedId] = useState<string | undefined>(undefined)

  const greeting = greetingForHour(new Date().getHours())
  const name = userDoc.greetingName || user?.displayName?.split(' ')[0]

  if (authLoading || dataLoading) {
    return (
      <>
        <HomeHero title={`${greeting}.`} />
      </>
    )
  }

  if (!user) {
    return (
      <>
        <HomeHero title={`${greeting}.`} subtitle="Drink what you enjoy. Share what matters." />
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
  const maybeTonight = getMaybeTonightCandidates(bottles, pours, 3, pickedId ? [pickedId] : [])
  const openBottles = getOpenBottles(bottles, pours)
  const collectionSnapshot = getCollectionSnapshot(bottles)

  return (
    <>
      <HomeHero title={name ? `${greeting}, ${name}.` : `${greeting}.`} subtitle="What are you pouring tonight?" />

      {bottles.length === 0 ? (
        <>
          <EmptyState
            title="Your whiskey journey starts here."
            message="Add a bottle to begin building your bar."
            action={
              <Link to="/bottles/new">
                <Button>Add a Bottle</Button>
              </Link>
            }
          />
          <Section title="AXE Insight">
            <AxeInsightCard uid={user.uid} bottles={bottles} pours={pours} />
          </Section>
        </>
      ) : (
        <>
          <WhatShouldIPourCard uid={user.uid} bottles={bottles} pours={pours} onPickChange={setPickedId} />

          <QuickActions />

          {featuredBottle || lastBlind ? (
            <Section title="Continue Your Journey">
              <div className={styles.journeyStack}>
                {featuredBottle ? <ContinueYourPourStoryCard bottle={featuredBottle} pours={pours} /> : null}
                {lastBlind ? <LastBlindCard summary={lastBlind} /> : null}
              </div>
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

          {maybeTonight.length > 0 ? (
            <Section title="Maybe Tonight" viewAllHref="/collection">
              <SectionRow>
                {maybeTonight.map((candidate) => (
                  <MaybeTonightCard key={candidate.bottle.id} candidate={candidate} />
                ))}
              </SectionRow>
            </Section>
          ) : null}

          <Section title="Your Bar Snapshot" viewAllHref="/collection">
            <CollectionSnapshot snapshot={collectionSnapshot} />
          </Section>

          <Section title="AXE Insight">
            <AxeInsightCard uid={user.uid} bottles={bottles} pours={pours} />
          </Section>
        </>
      )}
    </>
  )
}
