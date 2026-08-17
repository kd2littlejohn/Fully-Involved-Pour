import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section, SectionRow } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { SecondaryActionCard } from '../../components/ui/SecondaryActionCard'
import { SignInButton } from '../../components/domain/SignInButton'
import { StartAPourButton } from '../../features/startAPour/StartAPourButton'
import { WhatShouldIPourButton } from '../../features/whatShouldIPour/WhatShouldIPourButton'
import { ContinueYourPourStoryCard } from '../../features/home/ContinueYourPourStoryCard'
import { MaybeTonightCard } from '../../features/home/MaybeTonightCard'
import { LastBlindCard } from '../../features/home/LastBlindCard'
import { PalateInsightCard, PalateInsightEmptyCard } from '../../features/home/PalateInsightCard'
import { useLastBlindSummary } from '../../features/home/useLastBlindSummary'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { getFeaturedOpenBottle, getMaybeTonightCandidates, getPalateInsight, greetingForHour } from '../../features/home/selectors'
import styles from './HomePage.module.css'

const BOTTLE_ICON = (
  <svg width="20" height="20" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M9.5 1h5v4.75c0 .7.3 1.35.85 1.8 1.4 1.2 2.15 2.95 2.15 4.8V27a3 3 0 0 1-3 3h-5a3 3 0 0 1-3-3V12.35c0-1.85.75-3.6 2.15-4.8.55-.45.85-1.1.85-1.8V1Z"
      stroke="currentColor"
      strokeWidth="1.6"
    />
    <path d="M8.5 1h7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
)

export function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()
  const { summary: lastBlind } = useLastBlindSummary(user?.uid)

  const greeting = greetingForHour(new Date().getHours())
  const name = userDoc.greetingName || user?.displayName?.split(' ')[0]

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Home" title={`${greeting}.`} />
  }

  if (!user) {
    return (
      <>
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
  const palateInsight = getPalateInsight(bottles, pours)

  return (
    <>
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
          <div className={styles.primaryAction}>
            <StartAPourButton label="Start a Pour" />
          </div>

          <div className={styles.actions}>
            <WhatShouldIPourButton />
            <SecondaryActionCard icon={BOTTLE_ICON} title="Add a Bottle" subtitle="Grow your collection" to="/bottles/new" />
          </div>

          {featuredBottle ? (
            <Section title="Continue Your Pour Story" viewAllHref="/collection">
              <ContinueYourPourStoryCard bottle={featuredBottle} pours={pours} />
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

          <div className={styles.insightsRow}>
            {lastBlind ? (
              <div className={styles.insightCell}>
                <LastBlindCard summary={lastBlind} />
              </div>
            ) : null}
            <div className={styles.insightCell}>
              {palateInsight ? <PalateInsightCard insight={palateInsight} /> : <PalateInsightEmptyCard />}
            </div>
          </div>
        </>
      )}
    </>
  )
}
