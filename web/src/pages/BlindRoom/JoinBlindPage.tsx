import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { controlClassName } from '../../components/ui/Field'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import {
  RoomCodeInvalidError,
  getBlindRoomByCode,
  isPermissionDenied as isPermissionDeniedError,
  joinBlindRoomByCode,
  sessionTypeLabel,
} from '../../data/repositories/blindRoom'
import type { BlindRoom } from '../../data/types'
import styles from './JoinBlindPage.module.css'

export function JoinBlindPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { userDoc } = useUserData()

  const [codeInput, setCodeInput] = useState(searchParams.get('code')?.toUpperCase() ?? '')
  const [room, setRoom] = useState<BlindRoom | null | undefined>(undefined)
  const [looking, setLooking] = useState(false)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function lookUp(code: string) {
    if (!code.trim()) return
    setLooking(true)
    setError(null)
    setRoom(undefined)
    const found = await getBlindRoomByCode(code)
    setRoom(found ?? null)
    if (!found) setError('That room code doesn’t match an active Blind Room.')
    setLooking(false)
  }

  // Intentionally runs once on mount only — re-running on every
  // searchParams identity change would re-trigger the lookup any time the
  // URL changes for unrelated reasons.
  useEffect(() => {
    const fromUrl = searchParams.get('code')
    if (fromUrl) void lookUp(fromUrl)
  }, [])

  async function handleJoin() {
    if (!user || !room) return
    setJoining(true)
    setError(null)
    try {
      const username = userDoc.username || user.displayName || 'Guest'
      const joined = await joinBlindRoomByCode(room.code, user.uid, username)
      navigate(`/blind/${joined.id}/lobby`)
    } catch (err) {
      console.error('[JoinBlindPage] handleJoin failed', { uid: user.uid, roomId: room.id, code: room.code, err })
      if (err instanceof RoomCodeInvalidError) {
        setError('That room code doesn’t match an active Blind Room.')
      } else if (isPermissionDeniedError(err)) {
        setError('You don’t have permission to join this Blind Room. It may have been deleted or ended.')
      } else {
        setError('Could not join that Blind Room. Please try again.')
      }
    } finally {
      setJoining(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate('/blind')} aria-label="Back">
          ←
        </button>
        <h1 className={styles.title}>Join Blind</h1>
        <div className={styles.headerSpacer} />
      </div>

      <div className={styles.content}>
        <label className={styles.label} htmlFor="join-code">
          Room code
        </label>
        <div className={styles.codeRow}>
          <input
            id="join-code"
            className={controlClassName}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
            placeholder="OAK742"
            maxLength={8}
          />
          <Button variant="secondary" onClick={() => void lookUp(codeInput)} disabled={looking || !codeInput.trim()}>
            {looking ? 'Looking…' : 'Find'}
          </Button>
        </div>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        {room ? (
          <div className={styles.preview}>
            <div className={styles.previewName}>{room.name}</div>
            <div className={styles.previewMeta}>Hosted by {room.hostUsername}</div>
            <div className={styles.previewMeta}>
              {sessionTypeLabel(room.sessionType)} ·{' '}
              {room.pourCount} pours ·{' '}
              {room.knowledgeMode === 'single' ? 'Single Blind' : 'Double Blind'}
            </div>
            {room.deadline ? <div className={styles.previewMeta}>Deadline {new Date(room.deadline).toLocaleString()}</div> : null}

            {authLoading ? null : !user ? (
              <div className={styles.signIn}>
                <p className={styles.signInPrompt}>Sign in to join this Blind Room.</p>
                <SignInButton />
              </div>
            ) : (
              <Button onClick={handleJoin} disabled={joining}>
                {joining ? 'Joining…' : 'Join Blind'}
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
