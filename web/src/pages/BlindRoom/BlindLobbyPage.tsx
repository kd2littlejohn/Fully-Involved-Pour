import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useBlindRoom } from '../../hooks/useBlindRoom'
import { joinBlindRoomByCode, revealBlind, setParticipantReady, startBlind } from '../../data/repositories/blindRoom'
import styles from './BlindLobbyPage.module.css'

function inviteMessage(roomName: string, pourCount: number, knowledgeMode: string, code: string): string {
  const mode = knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'
  return `Join my Fully Involved Pour Blind Room.\n${roomName}\n${pourCount} pours · ${mode}\nRoom code: ${code}`
}

export function BlindLobbyPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { userDoc } = useUserData()
  const { room, participants, loading, refresh } = useBlindRoom(roomId)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const me = user ? participants.find((p) => p.uid === user.uid) : undefined
  const isHost = !!user && room?.hostUid === user.uid
  const allReady = participants.length > 0 && participants.every((p) => p.status === 'ready')
  const canStart = isHost && participants.length >= 2 && allReady
  const allCompleted = participants.length > 0 && participants.every((p) => p.status === 'completed')

  async function handleJoinAsViewer() {
    if (!user || !room) return
    setBusy(true)
    const username = userDoc.username || user.displayName || 'Guest'
    await joinBlindRoomByCode(room.code, user.uid, username)
    refresh()
    setBusy(false)
  }

  async function handleToggleReady() {
    if (!user || !room || !me) return
    setBusy(true)
    await setParticipantReady(room.id, user.uid, me.status !== 'ready')
    refresh()
    setBusy(false)
  }

  async function handleStart() {
    if (!room) return
    setBusy(true)
    await startBlind(room.id)
    refresh()
    setBusy(false)
  }

  // Host-only, enforced by firestore.rules — see revealBlind's own comment
  // for why this single-field write is safe without a Cloud Function.
  async function handleReveal() {
    if (!room) return
    setBusy(true)
    await revealBlind(room.id)
    refresh()
    setBusy(false)
  }

  async function handleShare() {
    if (!room) return
    const url = `${window.location.origin}${window.location.pathname}#/blind/join?code=${room.code}`
    const text = inviteMessage(room.name, room.pourCount, room.knowledgeMode, room.code)
    if (navigator.share) {
      try {
        await navigator.share({ title: room.name, text: `${text}\n${url}`, url })
        return
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (authLoading || loading) {
    return <div className={styles.page} />
  }

  if (!room) {
    return (
      <div className={styles.page}>
        <EmptyState title="We couldn’t find this Blind Room." message="It may have been cancelled or the link is incorrect." />
      </div>
    )
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <EmptyState title="Sign in to continue." message="Sign in to join this Blind Room." action={<SignInButton />} />
        </div>
      </div>
    )
  }

  if (!me) {
    return (
      <div className={styles.page}>
        <div className={styles.content}>
          <EmptyState
            title={room.name}
            message="You haven’t joined this Blind Room yet."
            action={
              <Button onClick={() => void handleJoinAsViewer()} disabled={busy}>
                {busy ? 'Joining…' : 'Join Blind'}
              </Button>
            }
          />
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/blind')} aria-label="Back">
          ←
        </button>
        <h1 className={styles.title}>{room.name}</h1>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.content}>
        <p className={styles.meta}>
          {room.knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'} · {room.pourCount} Pours
        </p>

        {room.state === 'lobby' ? (
          <>
            <div className={styles.inviteRow}>
              <div className={styles.code}>{room.code}</div>
              <Button variant="secondary" onClick={() => void handleShare()}>
                {copied ? 'Link Copied' : 'Share Invite'}
              </Button>
            </div>

            <div className={styles.roster}>
              {participants.map((p) => (
                <div className={styles.participantRow} key={p.uid}>
                  <span className={styles.participantName}>{p.username}</span>
                  <span className={styles.participantStatus}>
                    {p.isHost ? <Badge tone="brass">Host</Badge> : null}
                    <Badge tone={p.status === 'ready' ? 'amber' : 'default'}>
                      {p.status === 'ready' ? 'Ready' : p.status === 'joined' ? 'Joined' : p.status}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.readyCount}>
              {participants.filter((p) => p.status === 'ready').length} of {participants.length} ready
            </p>

            <div className={styles.actions}>
              <Button variant={me.status === 'ready' ? 'ghost' : 'primary'} onClick={() => void handleToggleReady()} disabled={busy}>
                {me.status === 'ready' ? 'Not Ready' : 'I’m Ready'}
              </Button>
              {isHost ? (
                <Button onClick={() => void handleStart()} disabled={busy || !canStart}>
                  Start Blind
                </Button>
              ) : null}
            </div>
          </>
        ) : room.state === 'revealed' ? (
          <>
            <div className={styles.roster}>
              {participants.map((p) => (
                <div className={styles.participantRow} key={p.uid}>
                  <span className={styles.participantName}>{p.username}</span>
                  <span className={styles.participantStatus}>
                    {p.isHost ? <Badge tone="brass">Host</Badge> : null}
                    <Badge tone="amber">Revealed</Badge>
                  </span>
                </div>
              ))}
            </div>
            <div className={styles.actions}>
              <Button onClick={() => navigate(`/blind/${room.id}/reveal`)}>See Results</Button>
            </div>
          </>
        ) : (
          <>
            <div className={styles.roster}>
              {participants.map((p) => (
                <div className={styles.participantRow} key={p.uid}>
                  <span className={styles.participantName}>{p.username}</span>
                  <span className={styles.participantStatus}>
                    {p.isHost ? <Badge tone="brass">Host</Badge> : null}
                    <Badge tone={p.status === 'completed' ? 'amber' : 'default'}>
                      {p.status === 'completed' ? 'Finished' : p.status === 'tasting' ? 'Tasting' : 'Not started'}
                    </Badge>
                  </span>
                </div>
              ))}
            </div>
            <p className={styles.readyCount}>
              {participants.filter((p) => p.status === 'completed').length} of {participants.length} finished tasting
            </p>

            {me.status === 'completed' ? (
              <>
                <EmptyState
                  title="You’re all locked in."
                  message={
                    isHost && allCompleted
                      ? 'Everyone has finished tasting — ready to reveal?'
                      : 'Waiting on everyone else to finish tasting.'
                  }
                />
                {isHost && allCompleted ? (
                  <div className={styles.actions}>
                    <Button onClick={() => void handleReveal()} disabled={busy}>
                      {busy ? 'Revealing…' : 'Reveal'}
                    </Button>
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.actions}>
                <Button onClick={() => navigate(`/blind/${room.id}/taste`)}>
                  {me.status === 'tasting' ? 'Continue Tasting' : 'Start Tasting'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
