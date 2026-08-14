import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section, SectionRow } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { BottleCard } from '../../components/domain/BottleCard'
import { PourStoryCard } from '../../components/domain/PourStoryCard'
import { SignInButton } from '../../components/domain/SignInButton'
import { StartAPourButton } from '../../features/startAPour/StartAPourButton'
import { WhatShouldIPourButton } from '../../features/whatShouldIPour/WhatShouldIPourButton'
import { ContinueYourPourStoryCard } from '../../features/home/ContinueYourPourStoryCard'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import {
  getFeaturedOpenBottle,
  getIncomingBottles,
  getMaybeTonightBottles,
  getRecentBottles,
  getRecentPours,
  greetingForHour,
} from '../../features/home/selectors'
import { StartPourStoryButton } from '../../features/pourWizard/StartPourStoryButton'
import { QuickPourButton } from '../../features/quickPour/QuickPourButton'
import styles from './HomePage.module.css'

export function HomePage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()

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
  const maybeTonightBottles = getMaybeTonightBottles(bottles, pours)
  const incomingBottles = getIncomingBottles(bottles)
  const recentBottles = getRecentBottles(bottles)
  const recentPours = getRecentPours(pours)
  const bottleById = new Map(bottles.map((b) => [b.id, b]))

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
            <Link to="/bottles/new">
              <Button variant="secondary">Add a Bottle</Button>
            </Link>
          </div>

          {featuredBottle ? (
            <Section title="Continue Your Pour Story">
              <ContinueYourPourStoryCard bottle={featuredBottle} pours={pours} />
            </Section>
          ) : null}

          {maybeTonightBottles.length > 0 ? (
            <Section title="Maybe Tonight" viewAllHref="/collection">
              <SectionRow>
                {maybeTonightBottles.map((bottle) => (
                  <BottleCard key={bottle.id} bottle={bottle} />
                ))}
              </SectionRow>
            </Section>
          ) : null}

          {incomingBottles.length > 0 ? (
            <Section title="Coming Soon" viewAllHref="/collection">
              <SectionRow>
                {incomingBottles.map((bottle) => (
                  <BottleCard key={bottle.id} bottle={bottle} />
                ))}
              </SectionRow>
            </Section>
          ) : null}

          <Section title="Recently Added" viewAllHref="/collection">
            <SectionRow>
              {recentBottles.map((bottle) => (
                <BottleCard key={bottle.id} bottle={bottle} />
              ))}
            </SectionRow>
          </Section>

          <Section title="Recent Pour Stories" viewAllHref="/journal">
            {recentPours.length === 0 ? (
              <EmptyState
                title="Your first Pour Story starts here."
                message="Open a bottle, capture the pour, and begin your whiskey journey."
                action={
                  <div className={styles.emptyActions}>
                    <QuickPourButton />
                    <StartPourStoryButton variant="secondary" />
                  </div>
                }
              />
            ) : (
              <SectionRow>
                {recentPours.map((pour) => {
                  const bottle = bottleById.get(pour.bottleId)
                  return bottle ? <PourStoryCard key={pour.id} pour={pour} bottle={bottle} /> : null
                })}
              </SectionRow>
            )}
          </Section>

          <Section title="Discover What's Next" viewAllHref="/discover">
            <EmptyState
              title="Recommendations start with your bar."
              message="Head to Discover to see trending bottles and personalized picks."
            />
          </Section>
        </>
      )}
    </>
  )
}
