import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/LinkButton'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { ConfirmDialog } from '../../features/party/ConfirmDialog'
import { InvitePanel } from '../../features/party/InvitePanel'
import { ResultsView } from '../../features/party/ResultsView'
import { useMyBallots, useParty, usePartyGuests, usePartyResults, usePartySecrets } from '../../features/party/usePartyData'
import { MyTastingView } from '../../features/party/MyTastingView'
import { myTastingProgress, progressLabel } from '../../features/party/myTastingProgress'
import { recallHostView, rememberHostView, type HostView } from '../../features/party/guestSession'
import { ballotCount, categoryStateLabel, formatEventDate, partyStatusLabel } from '../../features/party/partyLabels'
import { partyDisplayUrl } from '../../features/party/partyLinks'
import { bottleSummary } from '../../features/party/partyBottle'
import {
  completeParty,
  createDisplayLink,
  deleteParty,
  partyErrorMessage,
  removePartyGuest,
  revealAllCategories,
  revokeDisplays,
  setCategoryState,
  setCurrentCategory,
  setHostTasting,
} from '../../data/repositories/party'
import { partyFormat, type Party, type PartyCategory, type PartyCategoryState, type PartySecrets } from '../../features/party/types'
import styles from '../../features/party/party.module.css'

type Pending =
  | { kind: 'state'; category: PartyCategory; to: PartyCategoryState }
  | { kind: 'revealAll' }
  | { kind: 'complete' }
  | { kind: 'delete' }
  | { kind: 'removeGuest'; uid: string; nickname: string }
  | { kind: 'stopTasting' }

const ACTIONS: Record<PartyCategoryState, { to: PartyCategoryState; label: string; primary?: boolean }[]> = {
  draft: [
    { to: 'voting_open', label: 'Open voting', primary: true },
    { to: 'ready', label: 'Mark ready' },
  ],
  ready: [
    { to: 'voting_open', label: 'Open voting', primary: true },
    { to: 'draft', label: 'Back to draft' },
  ],
  voting_open: [{ to: 'voting_closed', label: 'Close voting', primary: true }],
  voting_closed: [
    { to: 'revealed', label: 'Reveal bottles', primary: true },
    { to: 'voting_open', label: 'Reopen voting' },
  ],
  revealed: [],
}

// A regular tasting has nothing to reveal: closing voting shows results.
const REGULAR_ACTIONS: Partial<Record<PartyCategoryState, { to: PartyCategoryState; label: string; primary?: boolean }[]>> = {
  voting_open: [{ to: 'revealed', label: 'Close voting & show results', primary: true }],
}

const REGULAR_CLOSE = {
  title: 'Close voting and show results?',
  message: 'Voting ends for this round and everyone sees the rankings. This can’t be undone.',
}

// These change what guests can do or see, so they get a confirmation.
const CONFIRM: Partial<Record<PartyCategoryState, { title: string; message: string }>> = {
  voting_open: {
    title: 'Open voting?',
    message: 'Guests can start scoring right away. This round’s bottles and letters lock for good once voting opens.',
  },
  revealed: {
    title: 'Reveal the bottles?',
    message: 'Everyone will see which bottle was behind each letter, with the final rankings. This can’t be undone.',
  },
}

// The host's live control room: invite/QR, who's here, ballot counts,
// and each round's Draft → Ready → Voting Open → Voting Closed → Revealed
// controls. Every action is a server call that enforces the transition.
export function HostDashboardPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const party = useParty(partyId, Boolean(user))
  const isHost = Boolean(user && party.data && party.data.hostUid === user.uid)
  const secrets = usePartySecrets(partyId, isHost)
  const guests = usePartyGuests(partyId, isHost)
  const results = usePartyResults(partyId, isHost)
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [displayLink, setDisplayLink] = useState<string | null>(null)
  const [showBottles, setShowBottles] = useState<Record<string, boolean>>({})
  const [showResults, setShowResults] = useState<string | null>(null)
  const hostGuest = user ? guests.data.find((g) => g.uid === user.uid && g.isHost) : undefined
  const tasting = Boolean(isHost && hostGuest && !hostGuest.revoked)
  const myBallots = useMyBallots(partyId, user?.uid, tasting)
  const [viewChoice, setViewChoice] = useState<HostView>(() => (partyId ? recallHostView(partyId) : null) ?? 'manage')
  const view: HostView = tasting ? viewChoice : 'manage'
  // Each view keeps its own scroll position, so switching back lands on
  // the same round controls or the same sample.
  const scrollByView = useRef<Record<HostView, number>>({ manage: 0, tasting: 0 })
  const lastView = useRef<HostView>(view)
  useLayoutEffect(() => {
    if (lastView.current === view) return
    lastView.current = view
    window.scrollTo?.({ top: scrollByView.current[view] })
  }, [view])

  function switchView(next: HostView) {
    if (next === view) return
    scrollByView.current[view] = window.scrollY
    setViewChoice(next)
    if (partyId) rememberHostView(partyId, next)
  }

  if (authLoading || (user && party.loading)) return <PartyLoading />
  if (!user) return <PartyMessage title="Host dashboard" message="Sign in to your FIP account to run your party." action={<SignInButton />} />
  if (!party.data) return <PartyMessage title="Party not found" message="This party doesn’t exist, or you don’t have access to it." />
  if (!isHost) {
    return <PartyMessage title="Hosts only" message="This dashboard belongs to the party’s host." action={<LinkButton to={`/party/${party.data.id}`}>Go to the party</LinkButton>} />
  }

  const p: Party = party.data
  const completed = p.status === 'completed'
  const revealedCount = p.categories.filter((c) => c.state === 'revealed').length
  const closedCount = p.categories.filter((c) => c.state === 'voting_closed').length
  const activeGuests = guests.data.filter((g) => !g.revoked && !g.isHost)
  const regular = partyFormat(p) === 'regular'
  const progress = tasting ? myTastingProgress(p, myBallots.data) : null
  const totals = p.categories.reduce(
    (acc, c) => {
      const counts = ballotCount(p, c.id)
      return { digital: acc.digital + counts.digital, paper: acc.paper + counts.paper }
    },
    { digital: 0, paper: 0 },
  )

  async function run(fn: () => Promise<unknown>): Promise<boolean> {
    setBusy(true)
    setError(null)
    try {
      await fn()
      return true
    } catch (err) {
      setError(partyErrorMessage(err))
      return false
    } finally {
      setPending(null)
      setBusy(false)
    }
  }

  function requestState(category: PartyCategory, to: PartyCategoryState) {
    if (CONFIRM[to] || (regular && to === 'revealed')) setPending({ kind: 'state', category, to })
    else void run(() => setCategoryState(p.id, category.id, to))
  }

  async function openDisplay() {
    setError(null)
    try {
      const { token } = await createDisplayLink(p.id)
      const url = partyDisplayUrl(p.id, token)
      setDisplayLink(url)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setError(partyErrorMessage(err))
    }
  }

  return (
    <PartyPage back={{ to: '/blind/party', label: 'Party Mode' }} wide>
      <section className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        <div className={styles.row}>
          <span className={styles.eyebrow}>Host dashboard · {regular ? 'Regular tasting' : 'Blind tasting'}</span>
          <span className={`${styles.pill} ${p.status === 'live' ? styles.pillLive : completed ? styles.pillDone : ''}`}>{partyStatusLabel(p)}</span>
        </div>
        <h1 className={styles.title}>{p.name}</h1>
        {formatEventDate(p.eventDate) ? <p className={styles.muted}>{formatEventDate(p.eventDate)}</p> : null}
      </section>

      {tasting ? (
        <div className={styles.viewSwitch} role="tablist" aria-label="Host dashboard">
          <button
            type="button"
            role="tab"
            id="host-tab-manage"
            aria-selected={view === 'manage'}
            aria-controls="host-panel-manage"
            className={styles.viewTab}
            onClick={() => switchView('manage')}
          >
            <span className={styles.viewTabTitle}>Manage Party</span>
            <span className={styles.viewTabMeta}>
              {activeGuests.length} {activeGuests.length === 1 ? 'guest' : 'guests'}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="host-tab-tasting"
            aria-selected={view === 'tasting'}
            aria-controls="host-panel-tasting"
            className={styles.viewTab}
            onClick={() => switchView('tasting')}
          >
            <span className={styles.viewTabTitle}>My Tasting</span>
            <span className={`${styles.viewTabMeta} ${progress?.complete ? styles.viewTabDone : ''}`}>
              {progress ? progressLabel(progress) : completed ? 'Party wrapped up' : 'No round open yet'}
            </span>
          </button>
        </div>
      ) : null}

      {tasting ? (
        <div id="host-panel-tasting" role="tabpanel" aria-labelledby="host-tab-tasting" hidden={view !== 'tasting'} className={`${styles.stack} ${styles.viewPanel}`} style={{ gap: 'var(--fip-space-5)' }}>
          <MyTastingView party={p} guest={hostGuest!} ballots={myBallots.data} results={results.data} resumeAtLastSample />
        </div>
      ) : null}

      <div
        id="host-panel-manage"
        role={tasting ? 'tabpanel' : undefined}
        aria-labelledby={tasting ? 'host-tab-manage' : undefined}
        hidden={view !== 'manage'}
        className={`${styles.stack} ${styles.viewPanel}`}
        style={{ gap: 'var(--fip-space-5)' }}
      >
        <section className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
          <div className={styles.row}>
            {!completed ? (
              <LinkButton to={`/party/${p.id}/setup`} variant="secondary">
                Edit setup
              </LinkButton>
            ) : null}
            <LinkButton to={`/party/${p.id}/ballots`} variant="secondary">
              Paper ballots
            </LinkButton>
            <LinkButton to={`/party/${p.id}/print`} variant="secondary">
              Print scorecards
            </LinkButton>
            <Button variant="secondary" onClick={openDisplay}>
              TV display
            </Button>
            {completed ? <LinkButton to={`/party/${p.id}/recap`}>Party recap</LinkButton> : null}
          </div>
          {displayLink ? (
            <div className={styles.notice}>
              Display opened in a new tab. To use another screen, open this read-only link there (valid 24 hours):
              <input className={styles.input} readOnly value={displayLink} onFocus={(e) => e.currentTarget.select()} aria-label="Display link" style={{ marginTop: 8 }} />
              <Button variant="ghost" onClick={() => run(() => revokeDisplays(p.id)).then((ok) => ok && setDisplayLink(null))}>
                Disconnect all displays
              </Button>
            </div>
          ) : null}
        </section>

        {error ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}

        <div className={styles.statRow}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{activeGuests.length}</span>
            <span className={styles.statLabel}>Guests</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totals.digital}</span>
            <span className={styles.statLabel}>Digital ballots</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{totals.paper}</span>
            <span className={styles.statLabel}>Paper ballots</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>
              {revealedCount}/{p.categories.length}
            </span>
            <span className={styles.statLabel}>Rounds revealed</span>
          </div>
        </div>

        <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', alignItems: 'start' }}>
          <div className={styles.stack} style={{ gap: 'var(--fip-space-4)' }}>
            <div className={styles.spread}>
              <h2 className={styles.sectionTitle}>Rounds</h2>
              {closedCount > 0 && !completed ? (
                <Button variant={p.settings.revealByCategory ? 'secondary' : 'primary'} onClick={() => setPending({ kind: 'revealAll' })}>
                  Reveal all closed rounds ({closedCount})
                </Button>
              ) : null}
            </div>
            {p.categories.length === 0 ? <p className={styles.muted}>No rounds yet. Add some in Edit setup.</p> : null}
            {p.categories.map((category, index) => (
              <RoundCard
                key={category.id}
                index={index}
                party={p}
                category={category}
                secrets={secrets.data}
                showBottles={Boolean(showBottles[category.id])}
                onToggleBottles={() => setShowBottles((s) => ({ ...s, [category.id]: !s[category.id] }))}
                onAction={(to) => requestState(category, to)}
                onMakeCurrent={() => run(() => setCurrentCategory(p.id, category.id))}
                onShowResults={() => setShowResults(showResults === category.id ? null : category.id)}
                resultsOpen={showResults === category.id}
                busy={busy}
                disabled={completed}
              >
                {showResults === category.id && results.data[category.id] ? <ResultsView results={results.data[category.id]!} /> : null}
              </RoundCard>
            ))}
          </div>

          <div className={styles.stack} style={{ gap: 'var(--fip-space-4)' }}>
            <InvitePanel party={p} />

            <section className={styles.card} aria-labelledby="guests-heading">
              <div className={styles.spread}>
                <h2 id="guests-heading" className={styles.sectionTitle}>
                  Guests
                </h2>
                <span className={styles.pill}>
                  {activeGuests.length}
                  {p.capacity ? ` / ${p.capacity}` : ''}
                </span>
              </div>
              <div className={styles.listItem}>
                <span className={`${styles.grow} ${styles.truncate}`}>
                  {p.hostName} (you) · {tasting ? 'tasting too' : 'hosting only'}
                </span>
                {!completed ? (
                  tasting ? (
                    <Button variant="ghost" disabled={busy} onClick={() => setPending({ kind: 'stopTasting' })}>
                      Stop tasting
                    </Button>
                  ) : (
                    <Button variant="secondary" disabled={busy} onClick={() => run(() => setHostTasting(p.id, true))}>
                      I’m tasting too
                    </Button>
                  )
                ) : null}
              </div>
              {activeGuests.length === 0 ? (
                <p className={styles.muted}>Guests appear here as they join.</p>
              ) : (
                <ul className={styles.list}>
                  {activeGuests
                    .sort((a, b) => a.joinedAt - b.joinedAt)
                    .map((g) => (
                      <li key={g.uid} className={styles.listItem}>
                        <span className={`${styles.grow} ${styles.truncate}`}>
                          {g.nickname}
                          {g.uid === user.uid ? ' (you)' : ''}
                        </span>
                        {!completed && g.uid !== user.uid ? (
                          <Button variant="ghost" aria-label={`Remove ${g.nickname}`} onClick={() => setPending({ kind: 'removeGuest', uid: g.uid, nickname: g.nickname })}>
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                </ul>
              )}
              <p className={styles.muted}>
                Guests never see each other’s names here.{' '}
                {tasting ? 'Score your own pours in My Tasting; your ballot counts the same as every guest’s.' : 'Tasting along? Turn on “I’m tasting too” to score from this dashboard.'}
              </p>
            </section>

            {!completed ? (
              <section className={styles.card} aria-labelledby="wrap-heading">
                <h2 id="wrap-heading" className={styles.sectionTitle}>
                  Wrap up the party
                </h2>
                <p className={styles.muted}>Closes any open voting and builds the Party Recap from revealed rounds.</p>
                <label className={styles.label} htmlFor="host-notes">
                  Host notes for the recap (optional)
                </label>
                <textarea id="host-notes" className={styles.input} rows={3} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
                <Button onClick={() => setPending({ kind: 'complete' })}>Complete party</Button>
              </section>
            ) : null}

            <section className={styles.card}>
              <Button variant="danger" onClick={() => setPending({ kind: 'delete' })}>
                Delete party
              </Button>
            </section>
          </div>
        </div>

      </div>

      {pending?.kind === 'state' ? (
        <ConfirmDialog
          title={(regular && pending.to === 'revealed' ? REGULAR_CLOSE : CONFIRM[pending.to]!).title}
          message={(regular && pending.to === 'revealed' ? REGULAR_CLOSE : CONFIRM[pending.to]!).message}
          confirmLabel={pending.to === 'revealed' ? (regular ? 'Show results' : 'Reveal') : 'Open voting'}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(() => setCategoryState(p.id, pending.category.id, pending.to))}
        />
      ) : null}
      {pending?.kind === 'revealAll' ? (
        <ConfirmDialog
          title="Reveal every closed round?"
          message="All closed rounds reveal at once, with their rankings."
          confirmLabel="Reveal all"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(() => revealAllCategories(p.id))}
        />
      ) : null}
      {pending?.kind === 'complete' ? (
        <ConfirmDialog
          title="Complete the party?"
          message={`${p.categories.length - revealedCount} round(s) aren’t revealed and won’t appear in the recap. Voting and joining close.`}
          confirmLabel="Complete party"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(() => completeParty(p.id, notes.trim() || undefined)).then((ok) => ok && navigate(`/party/${p.id}/recap`))}
        />
      ) : null}
      {pending?.kind === 'delete' ? (
        <ConfirmDialog
          title="Delete this party?"
          message="Every round, ballot and result is permanently deleted for everyone. This can’t be undone."
          confirmLabel="Delete forever"
          danger
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(() => deleteParty(p.id)).then((ok) => ok && navigate('/blind/party', { replace: true }))}
        />
      ) : null}
      {pending?.kind === 'stopTasting' ? (
        <ConfirmDialog
          title="Stop tasting?"
          message="You keep every host control. Your scores in rounds that aren’t revealed yet stop counting; turn tasting back on to restore them."
          confirmLabel="Stop tasting"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(() => setHostTasting(p.id, false))}
        />
      ) : null}
      {pending?.kind === 'removeGuest' ? (
        <ConfirmDialog
          title={`Remove ${pending.nickname}?`}
          message="They lose access immediately, and their ballots in unrevealed rounds stop counting."
          confirmLabel="Remove guest"
          danger
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(() => removePartyGuest(p.id, pending.uid))}
        />
      ) : null}
    </PartyPage>
  )
}

function RoundCard({
  index,
  party,
  category,
  secrets,
  showBottles,
  onToggleBottles,
  onAction,
  onMakeCurrent,
  onShowResults,
  resultsOpen,
  busy,
  disabled,
  children,
}: {
  index: number
  party: Party
  category: PartyCategory
  secrets: PartySecrets | undefined
  showBottles: boolean
  onToggleBottles: () => void
  onAction: (to: PartyCategoryState) => void
  onMakeCurrent: () => void
  onShowResults: () => void
  resultsOpen: boolean
  busy: boolean
  disabled: boolean
  children?: ReactNode
}) {
  const counts = ballotCount(party, category.id)
  const samples = secrets?.categories?.[category.id]?.samples ?? []
  const isCurrent = party.currentCategoryId === category.id
  const regular = partyFormat(party) === 'regular'
  const actions = regular
    ? (REGULAR_ACTIONS[category.state] ?? ACTIONS[category.state])
    : ACTIONS[category.state].filter((a) => !(a.to === 'revealed' && !party.settings.revealByCategory))
  return (
    <section
      className={`${styles.card} ${category.state === 'voting_open' ? styles.cardHighlight : ''}`}
      aria-labelledby={`round-${category.id}`}
    >
      <div className={styles.spread}>
        <div className={styles.stack} style={{ gap: 2 }}>
          <span className={styles.muted}>Round {index + 1}{isCurrent ? ' · On screen' : ''}</span>
          <h3 id={`round-${category.id}`} className={styles.sectionTitle}>
            {category.name}
          </h3>
        </div>
        <span className={`${styles.pill} ${category.state === 'voting_open' ? styles.pillLive : category.state === 'revealed' ? styles.pillDone : ''}`}>
          {categoryStateLabel(category.state)}
        </span>
      </div>
      <p className={styles.muted}>
        {category.sampleLabels.length} samples · {counts.digital} digital · {counts.paper} paper ballots
        {category.lockedAt ? ' · Bottles locked' : ''}
      </p>
      {!disabled ? (
        <div className={styles.row}>
          {actions.map((a) => (
            <Button key={a.to} variant={a.primary ? 'primary' : 'secondary'} disabled={busy} onClick={() => onAction(a.to)}>
              {a.label}
            </Button>
          ))}
          {category.state === 'voting_closed' && !party.settings.revealByCategory && !regular ? (
            <span className={styles.muted}>Revealed together at the end.</span>
          ) : null}
          {!isCurrent ? (
            <Button variant="ghost" disabled={busy} onClick={onMakeCurrent}>
              Show on TV
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className={styles.row}>
        <Button variant="ghost" onClick={onToggleBottles} aria-expanded={showBottles}>
          {regular ? (showBottles ? 'Hide bottles' : 'Show bottles') : showBottles ? 'Hide bottle mapping' : 'Show bottle mapping (only you)'}
        </Button>
        {category.state === 'revealed' ? (
          <Button variant="ghost" onClick={onShowResults} aria-expanded={resultsOpen}>
            {resultsOpen ? 'Hide results' : 'View results'}
          </Button>
        ) : null}
      </div>
      {showBottles ? (
        samples.length ? (
          <ul className={styles.list}>
            {samples.map((s) => (
              <li key={s.id} className={styles.listItem}>
                <span className={`${styles.sampleBadge} ${styles.sampleBadgeSmall}`} aria-hidden="true">
                  {s.label}
                </span>
                <div className={styles.grow}>
                  <div className={styles.truncate}>
                    <span className={styles.srOnly}>Sample {s.label}: </span>
                    {s.bottle.name}
                  </div>
                  <div className={`${styles.muted} ${styles.truncate}`}>{bottleSummary(s.bottle)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className={styles.muted}>No bottles yet — add them in Edit setup.</p>
        )
      ) : null}
      {children}
    </section>
  )
}
