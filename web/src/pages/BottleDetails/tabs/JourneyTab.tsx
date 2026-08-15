import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Bottle, Memory, Pour } from '../../../data/types'
import { buildBottleStoryEvents, getMemoriesForBottle, getPoursForBottle } from '../../../features/bottleDetails/selectors'
import { BottleStorySummary } from '../../../features/bottleDetails/BottleStorySummary'
import { EmptyState } from '../../../components/ui/EmptyState'
import { Button } from '../../../components/ui/Button'
import { Timeline, type TimelineEvent } from '../../../components/domain/Timeline'
import { PourStoryDetail } from '../../../features/pourWizard/PourStoryDetail'
import { MemoryDetail } from '../../../features/memories/MemoryDetail'
import { StartPourStoryButton } from '../../../features/pourWizard/StartPourStoryButton'
import { QuickPourButton } from '../../../features/quickPour/QuickPourButton'
import { useAuth } from '../../../hooks/useAuth'
import { getBottleBlindHistory, type BottleBlindHistoryEntry } from '../../../data/repositories/blindRoom'
import styles from './JourneyTab.module.css'

interface JourneyTabProps {
  bottle: Bottle
  pours: Pour[]
  memories: Memory[]
  onViewAllPours: () => void
}

const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function BlindHistorySection({ entries }: { entries: BottleBlindHistoryEntry[] }) {
  if (entries.length === 0) return null
  return (
    <div className={styles.blindHistory}>
      <h3 className={styles.blindHistoryTitle}>Blind History</h3>
      {entries.map((entry) => (
        <Link to={`/blind/${entry.room.id}/reveal`} className={styles.blindHistoryRow} key={entry.room.id}>
          <div className={styles.blindHistoryRowHeader}>
            <span className={styles.blindHistoryRoomName}>{entry.room.name}</span>
            {entry.myResponse?.fipScore != null ? (
              <span className={styles.blindHistoryScore}>{entry.myResponse.fipScore.toFixed(1)}</span>
            ) : null}
          </div>
          <p className={styles.blindHistoryMeta}>
            Pour {entry.pour.label}
            {entry.room.revealedAt ? ` · ${dateFormatter.format(new Date(entry.room.revealedAt))}` : ''}
          </p>
          {entry.myResponse?.reaction ? <p className={styles.blindHistoryReaction}>{entry.myResponse.reaction}</p> : null}
        </Link>
      ))}
    </div>
  )
}

export function JourneyTab({ bottle, pours, memories, onViewAllPours }: JourneyTabProps) {
  const { user } = useAuth()
  const [selectedPour, setSelectedPour] = useState<Pour | null>(null)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)
  const [blindHistory, setBlindHistory] = useState<BottleBlindHistoryEntry[]>([])

  // Blind Room data lives outside the local userDoc, and a bottle can have
  // real Blind History with zero locally-logged Pours (blind tasting
  // responses never become regular Pour records) — so this is fetched
  // independently and rendered on both the empty-state and full-content
  // paths below, rather than folded into hasAnyStoryContent.
  useEffect(() => {
    if (!user) {
      setBlindHistory([])
      return
    }
    let cancelled = false
    getBottleBlindHistory(user.uid, bottle.id)
      .then((entries) => {
        if (!cancelled) setBlindHistory(entries)
      })
      .catch((err) => console.error('getBottleBlindHistory failed', err))
    return () => {
      cancelled = true
    }
  }, [user, bottle.id])

  const bottlePours = getPoursForBottle(pours, bottle.id)
  const bottleMemories = getMemoriesForBottle(memories, bottle.id)
  const hasAnyStoryContent = bottlePours.length > 0 || bottleMemories.length > 0 || bottle.status === 'finished'

  if (!hasAnyStoryContent) {
    if (bottle.status === 'sealed') {
      return (
        <>
          <EmptyState
            title="Your story with this bottle hasn't started yet."
            message="Whenever you're ready, pour a taste and this page will start filling in."
            action={
              <div className={styles.actions}>
                <QuickPourButton bottleId={bottle.id} />
                <StartPourStoryButton bottleId={bottle.id} variant="secondary" />
              </div>
            }
          />
          <BlindHistorySection entries={blindHistory} />
        </>
      )
    }
    return (
      <>
        <EmptyState title="This bottle's journey is just beginning." message="Its story will build as you log pours over time." />
        <BlindHistorySection entries={blindHistory} />
      </>
    )
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

      <BlindHistorySection entries={blindHistory} />

      {selectedPour ? <PourStoryDetail pour={selectedPour} bottle={bottle} onClose={() => setSelectedPour(null)} /> : null}
      {selectedMemory ? <MemoryDetail memory={selectedMemory} bottleName={bottle.name} onClose={() => setSelectedMemory(null)} /> : null}
    </>
  )
}
