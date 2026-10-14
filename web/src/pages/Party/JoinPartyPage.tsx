import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/LinkButton'
import { PartyLoading, PartyPage } from '../../features/party/PartyChrome'
import { useGuestIdentity } from '../../features/party/useGuestIdentity'
import { rememberRecoveryCode } from '../../features/party/guestSession'
import { formatEventDate } from '../../features/party/partyLabels'
import { joinParty, partyErrorMessage, previewParty, recoverGuest } from '../../data/repositories/party'
import type { PartyPreview } from '../../features/party/types'
import styles from '../../features/party/party.module.css'

// The guest's front door: scan the QR code (or type the code), enter a
// nickname, join. No email, password or app install. The first join signs
// the browser in anonymously; that identity is what owns the guest's
// ballots, never the nickname or the code.
export function JoinPartyPage() {
  const params = useParams<{ code?: string }>()
  const navigate = useNavigate()
  const { user, loading: identityLoading, ensureIdentity } = useGuestIdentity()
  const [code, setCode] = useState((params.code ?? '').toUpperCase())
  const [preview, setPreview] = useState<PartyPreview | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [nickname, setNickname] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null)
  const [joinedPartyId, setJoinedPartyId] = useState<string | null>(null)
  const [mode, setMode] = useState<'join' | 'recover'>('join')
  const [recoveryInput, setRecoveryInput] = useState('')

  const activeCode = (params.code ?? '').toUpperCase()

  useEffect(() => {
    if (!activeCode || identityLoading) return
    let cancelled = false
    setPreviewError(null)
    previewParty(activeCode)
      .then((p) => {
        if (!cancelled) setPreview(p)
      })
      .catch((err) => {
        if (!cancelled) setPreviewError(partyErrorMessage(err))
      })
    return () => {
      cancelled = true
    }
    // Re-preview when the identity changes so "already joined" is accurate.
  }, [activeCode, identityLoading, user?.uid])

  async function join(event: FormEvent) {
    event.preventDefault()
    if (!nickname.trim() || !preview) return
    setBusy(true)
    setError(null)
    try {
      await ensureIdentity()
      const result = await joinParty(activeCode, nickname.trim())
      if (result.recoveryCode) {
        rememberRecoveryCode(result.partyId, result.recoveryCode)
        setRecoveryCode(result.recoveryCode)
        setJoinedPartyId(result.partyId)
      } else {
        navigate(`/party/${result.partyId}`, { replace: true })
      }
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function recover(event: FormEvent) {
    event.preventDefault()
    if (!recoveryInput.trim()) return
    setBusy(true)
    setError(null)
    try {
      await ensureIdentity()
      const result = await recoverGuest(activeCode, recoveryInput.trim())
      if (result.recoveryCode) {
        rememberRecoveryCode(result.partyId, result.recoveryCode)
        setRecoveryCode(result.recoveryCode)
        setJoinedPartyId(result.partyId)
      } else {
        navigate(`/party/${result.partyId}`, { replace: true })
      }
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (!activeCode) {
    return (
      <PartyPage>
        <form
          className={`${styles.card} ${styles.cardWarm}`}
          onSubmit={(e) => {
            e.preventDefault()
            const normalized = code.replace(/[\s-]/g, '').toUpperCase()
            if (normalized) navigate(`/p/${normalized}`)
          }}
        >
          <span className={styles.eyebrow}>Party Mode</span>
          <h1 className={styles.title}>Join a Party</h1>
          <label className={styles.label} htmlFor="join-code">
            Party code
          </label>
          <input
            id="join-code"
            className={`${styles.input} ${styles.codeInput}`}
            value={code}
            maxLength={9}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="ABC 123"
            onChange={(e) => setCode(e.target.value.toUpperCase())}
          />
          <Button type="submit" disabled={!code.trim()}>
            Continue
          </Button>
        </form>
      </PartyPage>
    )
  }

  if (recoveryCode && joinedPartyId) {
    return (
      <PartyPage>
        <section className={`${styles.card} ${styles.cardWarm} ${styles.fadeIn}`} aria-labelledby="joined-heading">
          <span className={styles.eyebrow}>You’re in</span>
          <h1 id="joined-heading" className={styles.title}>
            Welcome to the party
          </h1>
          <p className={styles.subtitle}>
            If you switch phones or clear your browser, this code gets you back in with your scores. We’ll also keep it on this
            device.
          </p>
          <p className={styles.joinCode} aria-label={`Recovery code ${recoveryCode.split('').join(' ')}`}>
            {recoveryCode}
          </p>
          <Button onClick={() => navigate(`/party/${joinedPartyId}`, { replace: true })}>Let’s taste</Button>
        </section>
      </PartyPage>
    )
  }

  if (previewError) {
    return (
      <PartyPage>
        <section className={`${styles.card} ${styles.cardWarm}`} role="alert">
          <h1 className={styles.sectionTitle}>We couldn’t find that party</h1>
          <p className={styles.subtitle}>{previewError}</p>
          <p className={styles.muted}>Check the code with your host, or scan their QR code again.</p>
          <LinkButton to="/p" variant="secondary">
            Enter a different code
          </LinkButton>
        </section>
      </PartyPage>
    )
  }

  if (!preview) return <PartyLoading />

  const date = formatEventDate(preview.eventDate)

  return (
    <PartyPage>
      <section className={`${styles.card} ${styles.cardWarm} ${styles.fadeIn}`} aria-labelledby="party-heading">
        {preview.coverImageUrl ? (
          <img src={preview.coverImageUrl} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--fip-radius-md)' }} />
        ) : null}
        <span className={styles.eyebrow}>{preview.hostName} invites you to a blind tasting</span>
        <h1 id="party-heading" className={styles.title}>
          {preview.name}
        </h1>
        {date ? <p className={styles.muted}>{date}</p> : null}
        {preview.description ? <p className={styles.subtitle}>{preview.description}</p> : null}
        <p className={styles.muted}>
          {preview.categoryCount} {preview.categoryCount === 1 ? 'round' : 'rounds'} · No account needed · Taste, score, then
          see what you were really drinking.
        </p>
      </section>

      {preview.isHost ? (
        <section className={styles.card}>
          <p className={styles.subtitle}>You’re hosting this party.</p>
          <LinkButton to={`/party/${preview.partyId}/host`}>Open host dashboard</LinkButton>
        </section>
      ) : preview.guest ? (
        <section className={styles.card}>
          <p className={styles.subtitle}>Welcome back, {preview.guest.nickname}.</p>
          <LinkButton to={`/party/${preview.partyId}`}>Continue to the party</LinkButton>
        </section>
      ) : preview.joinBlocker && preview.status !== 'completed' ? (
        <section className={styles.card} role="status">
          <p className={styles.subtitle}>{preview.joinBlocker}</p>
          <Button variant="secondary" onClick={() => setMode('recover')}>
            Already joined? Use your recovery code
          </Button>
        </section>
      ) : preview.status === 'completed' ? (
        <section className={styles.card} role="status">
          <p className={styles.subtitle}>This party has wrapped up.</p>
          <Button variant="secondary" onClick={() => setMode('recover')}>
            Were you there? Use your recovery code
          </Button>
        </section>
      ) : mode === 'join' ? (
        <form className={styles.card} onSubmit={join}>
          <label id="nickname-label" className={styles.label} htmlFor="nickname">
            Your nickname
          </label>
          <input
            id="nickname"
            className={styles.input}
            value={nickname}
            maxLength={24}
            autoComplete="off"
            placeholder="What should we call you?"
            onChange={(e) => setNickname(e.target.value)}
          />
          <Button type="submit" disabled={busy || !nickname.trim()}>
            {busy ? 'Joining…' : 'Join Party'}
          </Button>
          <button type="button" className={styles.backLink} onClick={() => setMode('recover')}>
            Rejoining on a new device? Use your recovery code
          </button>
        </form>
      ) : null}

      {mode === 'recover' && !preview.guest && !preview.isHost ? (
        <form className={styles.card} onSubmit={recover}>
          <label className={styles.label} htmlFor="recovery">
            Recovery code
          </label>
          <input
            id="recovery"
            className={`${styles.input} ${styles.codeInput}`}
            value={recoveryInput}
            maxLength={11}
            autoComplete="off"
            autoCapitalize="characters"
            placeholder="XXXXX-XXXXX"
            onChange={(e) => setRecoveryInput(e.target.value.toUpperCase())}
          />
          <Button type="submit" disabled={busy || !recoveryInput.trim()}>
            {busy ? 'Checking…' : 'Rejoin'}
          </Button>
          {preview.status !== 'completed' && !preview.joinBlocker ? (
            <button type="button" className={styles.backLink} onClick={() => setMode('join')}>
              New here? Join with a nickname
            </button>
          ) : null}
        </form>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.muted}>
        Already have an FIP account? <Link to="/blind/party">Open Party Mode</Link> after signing in to keep this tasting in your history.
      </p>
    </PartyPage>
  )
}
