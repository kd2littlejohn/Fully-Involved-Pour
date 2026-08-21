import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { EmptyState } from '../../components/ui/EmptyState'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { useBlindRoom } from '../../hooks/useBlindRoom'
import {
  isPermissionDenied,
  joinBlindRoomByCode,
  revealBlind,
  setParticipantReady,
  startBlind,
} from '../../data/repositories/blindRoom'
import styles from './BlindLobbyPage.module.css'

function inviteMessage(roomName: string, pourCount: number, knowledgeMode: string, code: string): string {
  const mode = knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'
  return `Join my Fully Involved Pour Blind Room.\n${roomName}\n${pourCount} pours · ${mode}\nRoom code: ${code}`
}

// No push/email infrastructure exists in this app — the host nudges
// stragglers through their own channels (text, DM), same as invites. This
// just composes the message; sharing it is a manual, host-triggered action.
function reminderMessage(roomName: string, names: string[], deadline: number | undefined): string {
  const who = names.join(', ')
  const verb = names.length === 1 ? 'still needs' : 'still need'
  const by = deadline ? ` before ${new Date(deadline).toLocaleString()}` : ''
  return `Reminder: ${who} ${verb} to taste "${roomName}" on Fully Involved Pour${by}.`
}

export function BlindLobbyPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { userDoc } = useUserData()
  const { room, participants, loading, refresh } = useBlindRoom(roomId)
  const [busy, setBusy] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [reminderCopied, setReminderCopied] = useState(false)

  const me = user ? participants.find((p) => p.uid === user.uid) : undefined
  const isHost = !!user && room?.hostUid === user.uid
  const allReady = participants.length > 0 && participants.every((p) => p.status === 'ready')
  const canStart = isHost && participants.length >= 2 && allReady
  const allCompleted = participants.length > 0 && participants.every((p) => p.status === 'completed')
  // Blind Challenges run asynchronously over days — the host shouldn't be
  // stuck waiting forever on one straggler. Once the deadline passes, reveal
  // unlocks regardless of who's finished (see the M1 spec's own "Blind
  // Challenges may remain active until their deadline or all participants
  // finish").
  const deadlinePassed = room?.sessionType === 'challenge' && !!room.deadline && Date.now() >= room.deadline
  const readyToReveal = allCompleted || deadlinePassed
  const showDeadline = room?.sessionType === 'challenge' && !!room.deadline && room.state !== 'revealed' && room.state !== 'completed'
  const notDoneNames = participants.filter((p) => p.status !== 'completed').map((p) => p.username)
  const canRemind = isHost && room?.sessionType === 'challenge' && room.state === 'active' && notDoneNames.length > 0

  async function handleJoinAsViewer() {
    if (!user || !room) return
    setBusy(true)
    setJoinError(null)
    try {
      const username = userDoc.username || user.displayName || 'Guest'
      await joinBlindRoomByCode(room.code, user.uid, username)
      refresh()
    } catch (err) {
      console.error('[BlindLobbyPage] handleJoinAsViewer failed', { uid: user.uid, roomId: room.id, err })
      setJoinError(
        isPermissionDenied(err)
          ? 'You don’t have permission to join this Blind Room. It may have been deleted or ended.'
          : 'Could not join that Blind Room. Please try again.',
      )
    } finally {
      setBusy(false)
    }
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

  async function handleSendReminder() {
    if (!room || notDoneNames.length === 0) return
    const text = reminderMessage(room.name, notDoneNames, room.deadline)
    if (navigator.share) {
      try {
        await navigator.share({ title: room.name, text })
        return
      } catch {
        // user cancelled or share failed — fall through to clipboard
      }
    }
    await navigator.clipboard.writeText(text)
    setReminderCopied(true)
    setTimeout(() => setReminderCopied(false), 2000)
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
            message={joinError ?? 'You haven’t joined this Blind Room yet.'}
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

        {showDeadline ? (
          <p className={deadlinePassed ? `${styles.deadlineNote} ${styles.deadlinePassed}` : styles.deadlineNote}>
            {deadlinePassed ? 'Deadline passed' : `Deadline ${new Date(room.deadline!).toLocaleString()}`}
          </p>
        ) : null}

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
        ) : room.state === 'revealed' || room.state === 'completed' ? (
          // Nothing left to wait on for either state — same "go see the
          // results" roster, so a completed room never falls through to the
          // still-tasting branch below and re-shows stale "ready to reveal?"
          // messaging (or, worse, a still-live Reveal button) for a session
          // that's long since wrapped up.
          <>
            <div className={styles.roster}>
              {participants.map((p) => (
                <div className={styles.participantRow} key={p.uid}>
                  <span className={styles.participantName}>{p.username}</span>
                  <span className={styles.participantStatus}>
                    {p.isHost ? <Badge tone="brass">Host</Badge> : null}
                    <Badge tone="amber">{room.state === 'completed' ? 'Completed' : 'Revealed'}</Badge>
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

            {canRemind ? (
              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => void handleSendReminder()}>
                  {reminderCopied ? 'Reminder Copied' : 'Send Reminder'}
                </Button>
              </div>
            ) : null}

            {me.status === 'completed' ? (
              <>
                <EmptyState
                  title="You’re all locked in."
                  message={
                    isHost && readyToReveal
                      ? allCompleted
                        ? 'Everyone has finished tasting — ready to reveal?'
                        : 'The deadline has passed — ready to reveal?'
                      : deadlinePassed
                        ? 'The deadline has passed. Waiting for the host to reveal.'
                        : 'Waiting on everyone else to finish tasting.'
                  }
                />
                {isHost && readyToReveal ? (
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
