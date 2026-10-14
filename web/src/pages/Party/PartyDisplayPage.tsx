import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import fipHorizontal from '../../assets/brand/fip-horizontal.svg'
import { QrCode } from '../../features/party/QrCode'
import { ResultsView } from '../../features/party/ResultsView'
import { useGuestIdentity } from '../../features/party/useGuestIdentity'
import { useParty, usePartyRecap, usePartyResults } from '../../features/party/usePartyData'
import { activeCategory, ballotCount, categoryStateLabel, formatScore } from '../../features/party/partyLabels'
import { formatJoinCode, partyInviteUrl } from '../../features/party/partyLinks'
import { partyErrorMessage, redeemDisplay } from '../../data/repositories/party'
import type { PartyCategoryResults } from '../../features/party/types'
import styles from './PartyDisplayPage.module.css'

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Host-controlled reveal on the big screen: when a round's results appear
// (because the host revealed it), samples flip from last place up to the
// champion, one every couple of seconds. Reduced motion shows them at once.
function useRevealSequence(results: PartyCategoryResults | undefined): number {
  const [shown, setShown] = useState(0)
  const key = results ? `${results.categoryId}:${results.revealedAt}` : ''
  const total = results?.samples.length ?? 0
  const revealedAt = results?.revealedAt ?? 0
  useEffect(() => {
    if (!key) return
    if (prefersReducedMotion() || Date.now() - revealedAt > 60_000) {
      setShown(total)
      return
    }
    setShown(0)
    let step = 0
    const timer = window.setInterval(() => {
      step += 1
      setShown(step)
      if (step >= total) window.clearInterval(timer)
    }, 2200)
    return () => window.clearInterval(timer)
  }, [key, total, revealedAt])
  return shown
}

// Party Display: a read-only presentation session for a TV, laptop or
// tablet. It signs in anonymously and redeems the host's display token for
// read access to this one party — no host credentials, no bottle mapping,
// nothing it can change. Bottles appear only from revealed results.
export function PartyDisplayPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const { user, ensureIdentity } = useGuestIdentity()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const redeemed = useRef(false)
  const token = new URLSearchParams(location.search).get('t')

  useEffect(() => {
    if (!partyId || redeemed.current) return
    redeemed.current = true
    ;(async () => {
      try {
        await ensureIdentity()
        if (token) {
          await redeemDisplay(partyId, token)
          // Keep the token out of the address bar (and screenshots of it).
          navigate(location.pathname, { replace: true })
        }
        setReady(true)
      } catch (err) {
        setError(partyErrorMessage(err))
      }
    })()
  }, [partyId, token, ensureIdentity, navigate, location.pathname])

  const party = useParty(partyId, ready && Boolean(user))
  const results = usePartyResults(partyId, ready && Boolean(user) && Boolean(party.data))
  const recap = usePartyRecap(partyId, ready && Boolean(user) && party.data?.status === 'completed')

  const p = party.data
  const category = p ? (p.categories.find((c) => c.id === p.currentCategoryId) ?? activeCategory(p)) : undefined
  const categoryResults = category ? results.data[category.id] : undefined
  const shown = useRevealSequence(category?.state === 'revealed' ? categoryResults : undefined)

  function fullScreen() {
    void document.documentElement.requestFullscreen?.().catch(() => undefined)
  }

  if (error || party.error === 'denied') {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>
          <img src={fipHorizontal} alt="Fully Involved Pour" className={styles.logo} />
          <p className={styles.message}>{error ?? 'This display isn’t connected. Open a new display link from the host dashboard.'}</p>
        </div>
      </div>
    )
  }
  if (!p) {
    return (
      <div className={styles.screen}>
        <div className={styles.center}>
          <img src={fipHorizontal} alt="Fully Involved Pour" className={styles.logo} />
          <p className={styles.message}>Connecting…</p>
        </div>
      </div>
    )
  }

  const counts = category ? ballotCount(p, category.id) : { total: 0, digital: 0, paper: 0 }
  const joinOpen = p.status !== 'completed' && p.inviteActive && !(p.inviteExpiresAt && p.inviteExpiresAt < Date.now())
  // Reveal order: from the bottom of the standings up to the champion.
  const revealOrder = categoryResults ? [...categoryResults.samples].reverse() : []
  const visible = new Set(revealOrder.slice(0, shown).map((s) => s.label))
  const revealDone = categoryResults ? shown >= categoryResults.samples.length : false

  return (
    <div className={styles.screen}>
      <header className={styles.top}>
        <img src={fipHorizontal} alt="Fully Involved Pour" className={styles.logo} />
        <div className={styles.partyName}>{p.name}</div>
        <button type="button" className={styles.fullButton} onClick={fullScreen}>
          Full screen
        </button>
      </header>

      {p.status === 'completed' && recap.data ? (
        <main className={styles.main}>
          <div className={styles.eyebrow}>Final champions</div>
          <h1 className={styles.title}>{p.name}</h1>
          <ul className={styles.finals}>
            {recap.data.champions.map((c) => (
              <li key={c.categoryId} className={styles.finalItem}>
                <span className={styles.finalRound}>{c.categoryName}</span>
                <span className={styles.finalWinner}>{c.winners.length ? c.winners.map((w) => w.bottle.name).join(' & ') : '—'}</span>
                {c.winners[0] ? <span className={styles.finalScore}>{formatScore(c.winners[0].average ?? null)}</span> : null}
              </li>
            ))}
          </ul>
          {recap.data.highestRated[0] ? (
            <p className={styles.message}>
              Highest rated: <strong>{recap.data.highestRated.map((h) => h.bottle.name).join(' & ')}</strong> ({formatScore(recap.data.highestRated[0].average)})
            </p>
          ) : null}
        </main>
      ) : category ? (
        <main className={styles.main}>
          <div className={styles.eyebrow}>
            Round {p.categories.indexOf(category) + 1} of {p.categories.length} · {categoryStateLabel(category.state)}
          </div>
          <h1 className={styles.title}>{category.name}</h1>

          {category.state === 'revealed' && categoryResults ? (
            revealDone ? (
              <ResultsView results={categoryResults} presentation showComparisons={false} />
            ) : (
              <ol className={styles.revealList} aria-live="polite">
                {[...categoryResults.samples].map((s) => (
                  <li key={s.label} className={visible.has(s.label) ? `${styles.revealItem} ${styles.revealed}` : styles.revealItem}>
                    <span className={styles.revealLetter}>{s.label}</span>
                    <span className={styles.revealName}>{visible.has(s.label) ? s.bottle.name : '• • •'}</span>
                    <span className={styles.revealScore}>{visible.has(s.label) ? formatScore(s.average) : ''}</span>
                  </li>
                ))}
              </ol>
            )
          ) : (
            <div className={styles.samples}>
              {category.sampleLabels.map((label) => (
                <span key={label} className={styles.sample}>
                  {label}
                </span>
              ))}
            </div>
          )}

          {category.state !== 'revealed' ? (
            <div className={styles.stats}>
              <div>
                <span className={styles.statValue}>{counts.total}</span>
                <span className={styles.statLabel}>ballots in</span>
              </div>
              <div>
                <span className={styles.statValue}>{p.counts?.guests ?? 0}</span>
                <span className={styles.statLabel}>guests</span>
              </div>
            </div>
          ) : null}
        </main>
      ) : (
        <main className={styles.main}>
          <h1 className={styles.title}>Welcome</h1>
        </main>
      )}

      {joinOpen ? (
        <aside className={styles.join}>
          <div className={styles.qr}>
            <QrCode value={partyInviteUrl(p.joinCode)} size={220} label={`QR code to join ${p.name}`} />
          </div>
          <div>
            <div className={styles.joinLabel}>Scan to join · no account needed</div>
            <div className={styles.joinCode}>{formatJoinCode(p.joinCode)}</div>
          </div>
        </aside>
      ) : null}
    </div>
  )
}
