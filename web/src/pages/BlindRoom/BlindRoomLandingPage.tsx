import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { Section } from '../../components/layout/Section'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { getMyBlindRooms } from '../../data/repositories/blindRoom'
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

function RoomCard({ room }: { room: BlindRoom }) {
  return (
    <Link to={`/blind/${room.id}/lobby`} className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.cardName}>{room.name}</span>
        <Badge tone={room.state === 'lobby' ? 'amber' : 'default'}>{stateLabel(room.state)}</Badge>
      </div>
      <div className={styles.cardMeta}>
        {room.sessionType === 'live' ? 'Live Blind' : 'Blind Challenge'} · {room.pourCount} pours ·{' '}
        {room.knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'}
      </div>
      <div className={styles.cardMeta}>
        Hosted by {room.hostUsername} · {room.participantCount} {room.participantCount === 1 ? 'participant' : 'participants'}
      </div>
      {room.deadline ? <div className={styles.cardMeta}>Deadline {new Date(room.deadline).toLocaleString()}</div> : null}
    </Link>
  )
}

export function BlindRoomLandingPage() {
  const { user, loading: authLoading } = useAuth()
  const [rooms, setRooms] = useState<{ room: BlindRoom; participant: BlindParticipant }[] | null>(null)

  useEffect(() => {
    if (!user) {
      setRooms(null)
      return
    }
    let cancelled = false
    getMyBlindRooms(user.uid).then((result) => {
      if (!cancelled) setRooms(result)
    })
    return () => {
      cancelled = true
    }
  }, [user])

  if (authLoading) {
    return <PageHeader eyebrow="Journey" title="Blind Room" />
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="Journey" title="Blind Room" subtitle="Taste together. Guess independently. Reveal together." />
        <EmptyState
          title="Taste blind, together."
          message="Sign in to create or join a Blind Room."
          action={<SignInButton />}
        />
      </>
    )
  }

  const active = (rooms ?? []).filter(({ room }) => ACTIVE_STATES.has(room.state)).sort((a, b) => b.room.createdAt - a.room.createdAt)
  const recent = (rooms ?? [])
    .filter(({ room }) => !ACTIVE_STATES.has(room.state))
    .sort((a, b) => b.room.createdAt - a.room.createdAt)

  return (
    <>
      <PageHeader eyebrow="Journey" title="Blind Room" subtitle="Taste together. Guess independently. Reveal together." />

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
          <EmptyState title="No active Blind Rooms." message="Create one, or join with a room code from a friend." />
        ) : (
          <div className={styles.grid}>
            {active.map(({ room }) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </Section>

      {recent.length > 0 ? (
        <Section title="Recent Blinds">
          <div className={styles.grid}>
            {recent.map(({ room }) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </Section>
      ) : null}
    </>
  )
}
