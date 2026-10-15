import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { acceptCoHost, partyErrorMessage } from '../../data/repositories/party'
import styles from '../../features/party/party.module.css'

// /party/:partyId/cohost?t=… — the one-time link a host sends their co-host
// (pour assistant). Needs a signed-in FIP account; the server checks the
// token and that this account isn't the host or a tasting guest.
export function CoHostAcceptPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('t') ?? ''
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const { profile } = useUserData()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loading) return <PartyLoading />
  if (!partyId || !token) return <PartyMessage title="Link incomplete" message="This co-host link is missing something. Ask the host to send it again." />
  if (!user) {
    return (
      <PartyMessage
        title="Co-host a tasting"
        message="Sign in to your FIP account to accept. As co-host you’ll set up the bottles, hold the bottle key and help run the rounds."
        action={<SignInButton />}
      />
    )
  }

  async function accept() {
    setBusy(true)
    setError(null)
    try {
      await acceptCoHost(partyId!, token, profile?.displayName || user!.displayName || 'Co-host')
      navigate(`/party/${partyId}/host`, { replace: true })
    } catch (err) {
      setError(partyErrorMessage(err))
      setBusy(false)
    }
  }

  return (
    <PartyPage>
      <section className={styles.card}>
        <span className={styles.eyebrow}>Co-host invitation</span>
        <h1 className={styles.title}>Help run this tasting</h1>
        <p className={styles.muted}>
          You’ll be able to set up rounds and bottles, pour and label the samples, open voting, enter paper ballots and reveal results. You’ll hold the bottle
          key so the host can taste blind, which means co-hosts don’t score.
        </p>
        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <Button onClick={() => void accept()} disabled={busy}>
          {busy ? 'Joining…' : 'Become co-host'}
        </Button>
      </section>
    </PartyPage>
  )
}
