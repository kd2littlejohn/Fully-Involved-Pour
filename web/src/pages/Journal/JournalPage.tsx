import { useState } from 'react'
import { signInWithPopup } from 'firebase/auth'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Tabs, TabPanel } from '../../components/ui/Tabs'
import { Timeline } from '../../components/domain/Timeline'
import { PourStoryCard } from '../../components/domain/PourStoryCard'
import { BottleCard } from '../../components/domain/BottleCard'
import { MemoryCard } from '../../components/domain/MemoryCard'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { auth, googleProvider } from '../../data/firebase'
import { getJournalTimeline, getCompanionStats, getBottleJourneys } from '../../features/journal/selectors'
import { StartPourStoryButton } from '../../features/pourWizard/StartPourStoryButton'
import { CreateMemoryButton } from '../../features/memories/CreateMemoryButton'
import styles from './JournalPage.module.css'

const TABS = [
  { id: 'stories', label: 'Stories' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'memories', label: 'Memories' },
  { id: 'people', label: 'People' },
  { id: 'bottle-journeys', label: 'Bottle Journeys' },
]

export function JournalPage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()
  const [activeTab, setActiveTab] = useState('stories')

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Journal" title="Your Pour Stories." />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Journal" title="Your Pour Stories." subtitle="Capture and revisit your whiskey experiences." />
        <EmptyState
          title="Your first Pour Story starts here."
          message="Sign in to start capturing your pours."
          action={<Button onClick={() => signInWithPopup(auth, googleProvider)}>Sign in with Google</Button>}
        />
      </>
    )
  }

  const { bottles, pours, memories } = userDoc

  if (pours.length === 0 && memories.length === 0) {
    return (
      <>
        <PageHeader eyebrow="Journal" title="Your Pour Stories." subtitle="Capture and revisit your whiskey experiences." />
        <EmptyState
          title="Your first Pour Story starts here."
          message="Open a bottle, capture the pour, and begin your whiskey journey."
          action={
            <div className={styles.actions}>
              <StartPourStoryButton />
              <CreateMemoryButton />
            </div>
          }
        />
      </>
    )
  }

  const bottleById = new Map(bottles.map((b) => [b.id, b]))
  const recentPours = [...pours].sort((a, b) => b.date.localeCompare(a.date))
  const recentMemories = [...memories].sort((a, b) => b.date.localeCompare(a.date))
  const timelineEvents = getJournalTimeline(bottles, pours)
  const companions = getCompanionStats(pours)
  const journeyBottles = getBottleJourneys(bottles)

  return (
    <>
      <PageHeader eyebrow="Journal" title="Your Pour Stories." subtitle="Capture and revisit your whiskey experiences." />

      <div className={styles.actions}>
        <StartPourStoryButton />
        <CreateMemoryButton />
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <TabPanel>
        {activeTab === 'stories' ? (
          <div className={styles.storiesGrid}>
            {recentPours.map((pour) => {
              const bottle = bottleById.get(pour.bottleId)
              return bottle ? <PourStoryCard key={pour.id} pour={pour} bottle={bottle} /> : null
            })}
          </div>
        ) : null}

        {activeTab === 'timeline' ? <Timeline events={timelineEvents} /> : null}

        {activeTab === 'memories' ? (
          recentMemories.length === 0 ? (
            <EmptyState title="No memories captured yet." message="Save the people, places, and moments connected to your pours." />
          ) : (
            <div className={styles.storiesGrid}>
              {recentMemories.map((memory) => (
                <MemoryCard key={memory.id} memory={memory} bottleName={memory.bottleId ? bottleById.get(memory.bottleId)?.name : undefined} />
              ))}
            </div>
          )
        ) : null}

        {activeTab === 'people' ? (
          companions.length === 0 ? (
            <EmptyState title="Your shared journey begins here." message="Add who joined you during a Pour Story." />
          ) : (
            <>
              <div className={styles.favorite}>
                <div className={styles.favoriteLabel}>Favorite Companion</div>
                <div className={styles.favoriteName}>{companions[0]?.name}</div>
              </div>
              <div className={styles.companionList}>
                {companions.map((companion) => (
                  <div className={styles.companionRow} key={companion.name}>
                    <span className={styles.companionName}>{companion.name}</span>
                    <span className={styles.companionMeta}>
                      {companion.pourCount} {companion.pourCount === 1 ? 'pour' : 'pours'} · {companion.bottleIds.length}{' '}
                      {companion.bottleIds.length === 1 ? 'bottle' : 'bottles'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )
        ) : null}

        {activeTab === 'bottle-journeys' ? (
          journeyBottles.length === 0 ? (
            <EmptyState title="No bottle journeys yet." message="Open a bottle to start tracking its journey over time." />
          ) : (
            <div className={styles.grid}>
              {journeyBottles.map((bottle) => (
                <BottleCard key={bottle.id} bottle={bottle} />
              ))}
            </div>
          )
        ) : null}
      </TabPanel>
    </>
  )
}
