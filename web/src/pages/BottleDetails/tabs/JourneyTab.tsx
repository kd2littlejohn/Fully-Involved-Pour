import { useState } from 'react'
import type { Bottle, Memory, Pour } from '../../../data/types'
import { buildBottleStoryEvents, getMemoriesForBottle, getPoursForBottle } from '../../../features/bottleDetails/selectors'
import { BottleStorySummary } from '../../../features/bottleDetails/BottleStorySummary'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Button } from '../../../components/ui/Button'
import { Timeline, type TimelineEvent } from '../../../components/domain/Timeline'
import { PourStoryDetail } from '../../../features/pourWizard/PourStoryDetail'
import { MemoryDetail } from '../../../features/memories/MemoryDetail'
import { StartPourStoryButton } from '../../../features/pourWizard/StartPourStoryButton'
import styles from './JourneyTab.module.css'

interface JourneyTabProps {
  bottle: Bottle
  pours: Pour[]
  memories: Memory[]
  onViewAllPours: () => void
}

export function JourneyTab({ bottle, pours, memories, onViewAllPours }: JourneyTabProps) {
  const [selectedPour, setSelectedPour] = useState<Pour | null>(null)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)

  const bottlePours = getPoursForBottle(pours, bottle.id)
  const bottleMemories = getMemoriesForBottle(memories, bottle.id)
  const hasAnyStoryContent = bottlePours.length > 0 || bottleMemories.length > 0 || bottle.status === 'finished'

  if (!hasAnyStoryContent) {
    if (bottle.status === 'sealed') {
      return (
        <EmptyState
          title="Your story with this bottle hasn't started yet."
          message="Whenever you're ready, pour a taste and this page will start filling in."
          action={<StartPourStoryButton bottleId={bottle.id} />}
        />
      )
    }
    return <EmptyState title="This bottle's journey is just beginning." message="Its story will build as you log pours over time." />
  }

  const story = buildBottleStoryEvents(bottle, pours, memories)

  function handleEventClick(event: TimelineEvent) {
    if (event.pourId) {
      const pour = pours.find((p) => p.id === event.pourId)
      if (pour) setSelectedPour(pour)
      return
    }
    if (event.memoryId) {
      const memory = memories.find((m) => m.id === event.memoryId)
      if (memory) setSelectedMemory(memory)
    }
  }

  return (
    <>
      <BottleStorySummary bottle={bottle} pours={pours} />

      <Timeline events={story.events} onEventClick={handleEventClick} />

      {story.curated ? (
        <Button variant="ghost" className={styles.viewAll} onClick={onViewAllPours}>
          View all {story.totalPourCount} Pour Stories →
        </Button>
      ) : null}

      {selectedPour ? <PourStoryDetail pour={selectedPour} bottle={bottle} onClose={() => setSelectedPour(null)} /> : null}
      {selectedMemory ? <MemoryDetail memory={selectedMemory} bottleName={bottle.name} onClose={() => setSelectedMemory(null)} /> : null}
    </>
  )
}
