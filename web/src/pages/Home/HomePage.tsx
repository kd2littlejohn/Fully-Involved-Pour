import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section, SectionRow } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { BottleCard } from '../../components/domain/BottleCard'
import { PourStoryCard } from '../../components/domain/PourStoryCard'
import { SignInButton } from '../../components/domain/SignInButton'
import { RollTheDiceButton } from '../../features/diceRoll/RollTheDiceButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import {
  getFeaturedOpenBottle,
  getIncomingBottles,
  getRecentBottles,
  getRecentPours,
  greetingForHour,
} from '../../features/home/selectors'
import { StartPourStoryButton } from '../../features/pourWizard/StartPourStoryButton'
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
          message="Sign in to start building your collection and capturing every pour."
          action={<SignInButton />}
        />
      </>
    )
  }

  const { bottles, pours } = userDoc
  const featuredBottle = getFeaturedOpenBottle(bottles)
  const incomingBottles = getIncomingBottles(bottles)
  const recentBottles = getRecentBottles(bottles)
  const recentPours = getRecentPours(pours)
  const bottleById = new Map(bottles.map((b) => [b.id, b]))

  return (
    <>
      <PageHeader
        eyebrow="Home"
        title={name ? `${greeting}, ${name}.` : `${greeting}.`}
        subtitle="What story will you add today?"
      />

      {bottles.length === 0 ? (
        <EmptyState
          title="Your whiskey journey starts here."
          message="Add a bottle to begin building your collection."
          action={
            <Link to="/bottles/new">
              <Button>Add a Bottle</Button>
            </Link>
          }
        />
      ) : (
        <>
          <div className={styles.actions}>
            <Link to="/bottles/new">
              <Button variant="secondary">Add a Bottle</Button>
            </Link>
            <RollTheDiceButton />
          </div>

          {featuredBottle ? (
            <Section title="Continue Your Pour Story">
              <SectionRow>
                <BottleCard bottle={featuredBottle} />
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
                action={<StartPourStoryButton />}
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
              title="Recommendations start with your collection."
              message="Head to Discover to see trending bottles and personalized picks."
            />
          </Section>
        </>
      )}
    </>
  )
}
