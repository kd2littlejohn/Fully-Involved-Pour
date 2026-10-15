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
import { getMyBlindRooms, sessionTypeLabel } from '../../data/repositories/blindRoom'
import { getAttendedParties, getHostedParties } from '../../data/repositories/party'
import type { Party } from '../../features/party/types'
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
          {sessionTypeLabel(room.sessionType)} ·{' '}
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

interface ResumeTarget {
  name: string
  kind: string
  to: string
  createdAt: number
}

// The single most recent thing in progress — a Solo/Friends blind or a
// party you host or joined — so "Resume Tasting" is one tap.
function pickResumeTarget(
  rooms: { room: BlindRoom }[],
  hosted: Party[],
  attended: Party[],
  uid: string,
): ResumeTarget | null {
  const candidates: ResumeTarget[] = [
    ...rooms
      .filter(({ room }) => ACTIVE_STATES.has(room.state) && room.state !== 'revealed')
      .map(({ room }) => ({
        name: room.name,
        kind: room.sessionType === 'solo' ? 'Solo blind' : 'Blind with friends',
        to: room.state === 'active' || room.state === 'awaiting_final_rank' ? `/blind/${room.id}/taste` : `/blind/${room.id}/lobby`,
        createdAt: room.createdAt,
      })),
    ...hosted
      .filter((p) => p.status !== 'completed')
      .map((p) => ({
        name: p.name,
        kind: p.hostUid === uid ? 'Tasting party · You’re hosting' : 'Tasting party · You’re co-hosting',
        to: `/party/${p.id}/host`,
        createdAt: p.createdAt,
      })),
    ...attended
      .filter((p) => p.status !== 'completed')
      .map((p) => ({ name: p.name, kind: `Tasting party · Hosted by ${p.hostName}`, to: `/party/${p.id}`, createdAt: p.createdAt })),
  ]
  return candidates.sort((a, b) => b.createdAt - a.createdAt)[0] ?? null
}

const OPTIONS = [
  {
    to: '/blind/new?type=solo',
    title: 'Start Solo Blind Tasting',
    meta: 'Taste by yourself. No labels, just what you actually prefer.',
  },
  {
    to: '/blind/new?type=live',
    title: 'Taste with Friends',
    meta: 'Create a blind room and share its code.',
  },
  {
    to: '/party/new',
    title: 'Host a Tasting Party',
    meta: 'Blind or regular rounds, QR-code join, digital or paper ballots. Guests don’t need an account.',
  },
  {
    to: '/p',
    title: 'Join a Tasting Party',
    meta: 'Enter the host’s party code.',
  },
] as const

export function BlindRoomLandingPage() {
  const { user, loading: authLoading } = useAuth()
  const [rooms, setRooms] = useState<{ room: BlindRoom; participant: BlindParticipant }[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set())
  const [parties, setParties] = useState<{ hosted: Party[]; attended: Party[] }>({ hosted: [], attended: [] })

  // Parties only feed "Resume Tasting"; if they fail to load, the page
  // still works and the Party Mode hub has its own retry.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    Promise.all([getHostedParties(user.uid).catch(() => []), getAttendedParties(user.uid).catch(() => [])]).then(([hosted, attended]) => {
      if (!cancelled) setParties({ hosted, attended })
    })
    return () => {
      cancelled = true
    }
  }, [user])

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

  const resume = rooms ? pickResumeTarget(visible, parties.hosted, parties.attended, user.uid) : null

  return (
    <>
      <PageHeader eyebrow="Journey" title="Blind Room" subtitle="Remove the label. Find out what you actually prefer." />

      <div className={styles.options}>
        {resume ? (
          <Link to={resume.to} className={`${styles.partyCard} ${styles.resume}`}>
            <span className={styles.partyEyebrow}>Resume Tasting</span>
            <span className={styles.cardName}>{resume.name}</span>
            <span className={styles.cardMeta}>{resume.kind}</span>
          </Link>
        ) : null}
        <div className={styles.optionGrid}>
          {OPTIONS.map((option) => (
            <Link key={option.to} to={option.to} className={styles.option}>
              <span className={styles.optionTitle}>{option.title}</span>
              <span className={styles.cardMeta}>{option.meta}</span>
            </Link>
          ))}
        </div>
        <p className={styles.secondary}>
          Have a friend’s blind room code? <Link to="/blind/join">Join their blind</Link> · <Link to="/blind/party">All tasting parties</Link>
        </p>
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
