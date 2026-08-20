import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { SignInButton } from '../../components/domain/SignInButton'
import { BlindHistoryDeleteAction } from '../../features/blindRoom/BlindHistoryDeleteAction'
import { useAuth } from '../../hooks/useAuth'
import { getMyBlindRooms } from '../../data/repositories/blindRoom'
import { readHiddenBlindRoomIds } from '../../data/hiddenBlindRooms'
import type { BlindParticipant, BlindRoom } from '../../data/types'
import styles from './BlindRoomLandingPage.module.css'

const ACTIVE_STATES = new Set<BlindRoom['state']>(['draft', 'lobby', 'active', 'awaiting_final_rank', 'awaiting_reveal', 'revealed'])

function stateLabel(state: BlindRoom['state']): string {
  switch (state) {
    case 'lobby':
      return 'In Lobby'
    case 'active':
      return 'Tasting'
    case 'awaiting_final_rank':
      return 'Awaiting Ranking'
    case 'awaiting_reveal':
      return 'Awaiting Reveal'
    case 'revealed':
      return 'Revealed'
    case 'completed':
      return 'Completed'
    case 'cancelled':
      return 'Cancelled'
    default:
      return 'Draft'
  }
}

interface RoomCardProps {
  room: BlindRoom
  isHost: boolean
  uid: string
  onDeleted: (room: BlindRoom) => void
}

function RoomCard({ room, isHost, uid, onDeleted }: RoomCardProps) {
  // Revealed and completed rooms have results to show, not a lobby to wait
  // in — send them straight to the reveal page (same destination
  // BlindResultCard/JourneyTab already use for these two states).
  const destination =
    room.state === 'revealed' || room.state === 'completed' ? `/blind/${room.id}/reveal` : `/blind/${room.id}/lobby`
  return (
    <div className={styles.card}>
      <BlindHistoryDeleteAction room={room} uid={uid} isHost={isHost} onDeleted={onDeleted} />
      <Link to={destination} className={styles.cardLink}>
        <div className={styles.cardHeader}>
          <span className={styles.cardName}>{room.name}</span>
          <Badge tone={room.state === 'lobby' ? 'amber' : 'default'}>{stateLabel(room.state)}</Badge>
        </div>
        <div className={styles.cardMeta}>
          {room.sessionType === 'solo' ? 'Solo Blind' : room.sessionType === 'live' ? 'Live Blind' : 'Blind Challenge'} ·{' '}
          {room.pourCount} pours ·{' '}
          {room.knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'}
        </div>
        <div className={styles.cardMeta}>
          Hosted by {room.hostUsername} · {room.participantCount} {room.participantCount === 1 ? 'participant' : 'participants'}
        </div>
        {room.deadline ? <div className={styles.cardMeta}>Deadline {new Date(room.deadline).toLocaleString()}</div> : null}
      </Link>
    </div>
  )
}

export function BlindRoomLandingPage() {
  const { user, loading: authLoading } = useAuth()
  const [rooms, setRooms] = useState<{ room: BlindRoom; participant: BlindParticipant }[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    setHiddenIds(user ? readHiddenBlindRoomIds(user.uid) : new Set())
  }, [user])

  // Fires after BlindHistoryDeleteAction succeeds, host or participant path
  // alike — either way this device should stop showing the room immediately,
  // no refetch needed. For a participant's local-only hide, also record it
  // in hiddenIds so a later retryKey-triggered refetch (which re-reads every
  // room this uid still participates in) doesn't bring it back.
  function handleRoomDeleted(room: BlindRoom) {
    setRooms((prev) => (prev ?? []).filter((r) => r.room.id !== room.id))
    if (user && room.hostUid !== user.uid) {
      setHiddenIds((prev) => new Set(prev).add(room.id))
    }
  }

  useEffect(() => {
    if (!user) {
      setRooms(null)
      return
    }
    let cancelled = false
    setLoadError(null)
    getMyBlindRooms(user.uid)
      .then((result) => {
        if (!cancelled) setRooms(result)
      })
      .catch((err: unknown) => {
        console.error('getMyBlindRooms failed', err)
        const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : undefined
        const message = err instanceof Error ? err.message : String(err)
        if (!cancelled) setLoadError(code ? `${code}: ${message}` : message)
      })
    return () => {
      cancelled = true
    }
  }, [user, retryKey])

  if (authLoading) {
    return <PageHeader eyebrow="Journey" title="Blind Room" />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Journey" title="Blind Room" subtitle="Remove the label. Find out what you actually prefer." />
        <EmptyState
          title="Taste blind. Decide for yourself."
          message="Sign in to start a Blind Room, solo or with friends."
          action={<SignInButton />}
        />
      </>
    )
  }

  if (loadError) {
    return (
      <>
        <PageHeader eyebrow="Journey" title="Blind Room" subtitle="Remove the label. Find out what you actually prefer." />
        <EmptyState
          title="We couldn’t load your Blind Rooms."
          message={`Check your connection and try again. (${loadError})`}
          action={<Button onClick={() => setRetryKey((k) => k + 1)}>Retry</Button>}
        />
      </>
    )
  }

  const visible = (rooms ?? []).filter(({ room }) => !hiddenIds.has(room.id))
  const active = visible.filter(({ room }) => ACTIVE_STATES.has(room.state)).sort((a, b) => b.room.createdAt - a.room.createdAt)
  const recent = visible
    .filter(({ room }) => !ACTIVE_STATES.has(room.state))
    .sort((a, b) => b.room.createdAt - a.room.createdAt)

  return (
    <>
      <PageHeader eyebrow="Journey" title="Blind Room" subtitle="Remove the label. Find out what you actually prefer." />

      <div className={styles.actions}>
        <Link to="/blind/new">
          <Button>Create Blind</Button>
        </Link>
        <Link to="/blind/join">
          <Button variant="secondary">Join Blind</Button>
        </Link>
      </div>

      <Section title="Active Blinds">
        {active.length === 0 ? (
          <EmptyState title="No active Blind Rooms." message="Create one — solo, or with a room code from a friend." />
        ) : (
          <div className={styles.grid}>
            {active.map(({ room }) => (
              <RoomCard key={room.id} room={room} isHost={room.hostUid === user.uid} uid={user.uid} onDeleted={handleRoomDeleted} />
            ))}
          </div>
        )}
      </Section>

      {recent.length > 0 ? (
        <Section title="Recent Blinds">
          <div className={styles.grid}>
            {recent.map(({ room }) => (
              <RoomCard key={room.id} room={room} isHost={room.hostUid === user.uid} uid={user.uid} onDeleted={handleRoomDeleted} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  )
}
