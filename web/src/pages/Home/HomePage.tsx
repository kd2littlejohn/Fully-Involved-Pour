import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Section, SectionRow } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import { WhatShouldIPourCard } from '../../features/home/WhatShouldIPourCard'
import { QuickActions } from '../../features/home/QuickActions'
import { TastingEntries } from '../../features/home/TastingEntries'
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
import homeHeroMobileImage from '../../assets/home-hero-mobile.webp'
import styles from './HomePage.module.css'

const HERO_ALT = 'Fully Involved Pour — drink what you enjoy, share what matters.'

// Cinematic hero: the approved FIP artwork (compass mark, wordmark,
// tagline, lounge photography), never regenerated, cropped or stretched.
// - Phones: the portrait artwork is a full-bleed background layer at its
//   own proportions, running up behind the top bar and down behind the
//   greeting and Tonight's Pick. Its own dark lower fade carries it into
//   the page; only the last few pixels blend to the exact page colour.
// - Wider screens (>=600px): the landscape artwork, sharp with feathered
//   edges over a blurred copy of itself that fills the width.
function HomeHero({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className={styles.heroStage}>
      <div className={styles.heroAtmosphere} style={{ backgroundImage: `url(${homeHeroImage})` }} aria-hidden="true" />
      <div className={styles.heroShade} aria-hidden="true" />
      <div className={styles.hero}>
        <picture>
          <source media="(min-width: 600px)" srcSet={homeHeroImage} width={2000} height={667} />
          <img className={styles.heroImage} src={homeHeroMobileImage} alt={HERO_ALT} width={948} height={1659} />
        </picture>
      </div>
      {/* Brand line, laid over the hero's open dark wall (upper left). Absolutely
          positioned, so it never adds height or moves the greeting. */}
      <div className={styles.tagline}>
        <p className={styles.taglineHeadline}>
          <span>Discover More.</span>
          <span>Savor More.</span>
          <span className={styles.taglineGold}>Share More.</span>
        </p>
        <p className={styles.taglineText}>Discover new favorites, savor the experience, and capture the moments worth sharing.</p>
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
      <div className={styles.home}>
        <HomeHero title={`${greeting}.`} />
      </div>
    )
  }

  if (!user) {
    return (
      <div className={styles.home}>
        <HomeHero title={`${greeting}.`} subtitle="Drink what you enjoy. Share what matters." />
        <EmptyState
          title="Your whiskey journey starts here."
          message="Sign in to start building your bar and capturing every pour."
          action={<SignInButton />}
        />
      </div>
    )
  }

  const { bottles, pours } = userDoc
  const featuredBottle = getFeaturedOpenBottle(bottles)
  const maybeTonight = getMaybeTonightCandidates(bottles, pours, 3, pickedId ? [pickedId] : [])
  const openBottles = getOpenBottles(bottles, pours)
  const collectionSnapshot = getCollectionSnapshot(bottles)

  return (
    <div className={styles.home}>
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
          <TastingEntries hasBottles={false} />
          <Section title="AXE Insight">
            <AxeInsightCard uid={user.uid} bottles={bottles} pours={pours} />
          </Section>
        </>
      ) : (
        <>
          <WhatShouldIPourCard uid={user.uid} bottles={bottles} pours={pours} onPickChange={setPickedId} />

          <QuickActions />

          <TastingEntries hasBottles />

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
    </div>
  )
}
