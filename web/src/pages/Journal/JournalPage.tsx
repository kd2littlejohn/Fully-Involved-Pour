import { useState } from 'react'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Tabs, TabPanel } from '../../components/ui/Tabs'
import { Timeline, type TimelineEvent } from '../../components/domain/Timeline'
import { PourStoryCard } from '../../components/domain/PourStoryCard'
import { MemoryCard } from '../../components/domain/MemoryCard'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { getJournalTimeline, getCompanionStats, getBottleJourneys } from '../../features/journal/selectors'
import { BottleJourneyCard } from '../../features/journal/BottleJourneyCard'
import { StartPourStoryButton } from '../../features/pourWizard/StartPourStoryButton'
import { QuickPourButton } from '../../features/quickPour/QuickPourButton'
import { CreateMemoryButton } from '../../features/memories/CreateMemoryButton'
import { PourStoryDetail } from '../../features/pourWizard/PourStoryDetail'
import type { Pour } from '../../data/types'
import styles from './JournalPage.module.css'

// Primary sections first (Stories/Timeline/Bottles/People), Memories kept
// after them — a real, working feature, just not one of the four primary
// sections called out for this redesign. "Ask Assistant" is deliberately
// removed as a permanent tab here: AI becomes contextual elsewhere later,
// not a standing top-level destination (SommelierProvider/Panel stay in the
// codebase for that future contextual reuse, just unreachable from this tab
// strip for now).
const TABS = [
  { id: 'stories', label: 'Stories' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'bottles', label: 'Bottles' },
  { id: 'people', label: 'People' },
  { id: 'memories', label: 'Memories' },
]

export function JournalPage() {
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading } = useUserData()
  const [activeTab, setActiveTab] = useState('stories')
  const [selectedTimelinePour, setSelectedTimelinePour] = useState<Pour | null>(null)

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="Journey" title="Your Pour Stories." />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Journey" title="Your Pour Stories." subtitle="Capture and revisit your whiskey experiences." />
        <EmptyState
          title="Your first Pour Story starts here."
          message="Sign in to start capturing your pours."
          action={<SignInButton />}
        />
      </>
    )
  }

  const { bottles, pours, memories } = userDoc

  const bottleById = new Map(bottles.map((b) => [b.id, b]))
  const recentPours = [...pours].sort((a, b) => b.date.localeCompare(a.date))
  const recentMemories = [...memories].sort((a, b) => b.date.localeCompare(a.date))
  const timelineEvents = getJournalTimeline(bottles, pours)
  const companions = getCompanionStats(pours)
  const journeyBottles = getBottleJourneys(bottles)

  function handleTimelineEventClick(event: TimelineEvent) {
    const pour = pours.find((p) => p.id === event.pourId)
    if (pour) setSelectedTimelinePour(pour)
  }

  const selectedTimelineBottle = selectedTimelinePour ? bottleById.get(selectedTimelinePour.bottleId) : undefined

  return (
    <>
      <PageHeader eyebrow="Journey" title="Your Pour Stories." subtitle="Capture and revisit your whiskey experiences." />

      <div className={styles.actions}>
        <QuickPourButton />
        <StartPourStoryButton variant="secondary" />
        <CreateMemoryButton />
      </div>

      <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />

      <TabPanel>
        {activeTab === 'stories' ? (
          recentPours.length === 0 ? (
            <EmptyState
              title="Your first Pour Story starts here."
              message="Open a bottle, capture the pour, and begin your whiskey journey."
              action={
                <div className={styles.actions}>
                  <QuickPourButton />
                  <StartPourStoryButton variant="secondary" />
                  <CreateMemoryButton />
                </div>
              }
            />
          ) : (
            <div className={styles.storiesGrid}>
              {recentPours.map((pour) => {
                const bottle = bottleById.get(pour.bottleId)
                return bottle ? <PourStoryCard key={pour.id} pour={pour} bottle={bottle} /> : null
              })}
            </div>
          )
        ) : null}

        {activeTab === 'timeline' ? <Timeline events={timelineEvents} onEventClick={handleTimelineEventClick} /> : null}

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

        {activeTab === 'bottles' ? (
          journeyBottles.length === 0 ? (
            <EmptyState title="No bottle journeys yet." message="Open a bottle to start tracking its journey over time." />
          ) : (
            <div className={styles.storiesGrid}>
              {journeyBottles.map((bottle) => (
                <BottleJourneyCard key={bottle.id} bottle={bottle} pours={pours} />
              ))}
            </div>
          )
        ) : null}
      </TabPanel>

      {selectedTimelinePour && selectedTimelineBottle ? (
        <PourStoryDetail pour={selectedTimelinePour} bottle={selectedTimelineBottle} onClose={() => setSelectedTimelinePour(null)} />
      ) : null}
    </>
  )
}
