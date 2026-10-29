import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/LinkButton'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { ConfirmDialog } from '../../features/party/ConfirmDialog'
import { InvitePanel } from '../../features/party/InvitePanel'
import { ResultsView } from '../../features/party/ResultsView'
import {
  useGuidedBottles,
  useMyAdminRole,
  useMyBallots,
  useParty,
  usePartyAdmins,
  usePartyGuests,
  usePartyResults,
  usePartyRoster,
} from '../../features/party/usePartyData'
import { GROUP_LABEL, GROUPS, groupCounts, groupProgress, guestGroup, type GroupProgress } from '../../features/party/dualGroups'
import { TastingIndicator, WhoIsTasting } from '../../features/party/WhoIsTasting'
import { coHostRosterId } from '../../features/party/rosterView'
import { MyTastingView } from '../../features/party/MyTastingView'
import { myTastingProgress, progressLabel } from '../../features/party/myTastingProgress'
import { recallHostView, rememberHostView, type HostView } from '../../features/party/guestSession'
import { ballotCount, categoryStateLabel, formatEventDate, partyStatusLabel } from '../../features/party/partyLabels'
import { partyCoHostUrl, partyDisplayUrl, shareOrCopy } from '../../features/party/partyLinks'
import { bottleSummary, publicBottleSummary } from '../../features/party/partyBottle'
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
  getBottleKey,
  getKeyAccessLog,
  createCoHostInvite,
  removeCoHost,
  assignPartyGroup,
  type BottleKey,
  type KeyAccessEntry,
  syncRoster,
} from '../../data/repositories/party'
import { partyFormat, type Party, type PartyCategory, type PartyCategoryState, type PartyGroup } from '../../features/party/types'
import styles from '../../features/party/party.module.css'

type Pending =
  | { kind: 'state'; category: PartyCategory; to: PartyCategoryState }
  | { kind: 'revealAll' }
  | { kind: 'complete' }
  | { kind: 'delete' }
  | { kind: 'removeGuest'; uid: string; nickname: string }
  | { kind: 'stopTasting' }
  | { kind: 'viewKey'; categoryId?: string }
  | { kind: 'removeCoHost'; uid: string; name: string }
  | { kind: 'moveGroup'; participantKey: string; name: string; group: PartyGroup; scoredRounds: number }

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
  // Host or co-host (pour assistant), from this account's own protected
  // admin record. Co-hosts run the event but never taste.
  const adminRole = useMyAdminRole(partyId, user?.uid)
  const isHost = adminRole.role === 'host'
  const isAdmin = adminRole.role !== null
  const admins = usePartyAdmins(partyId, isAdmin)
  const guests = usePartyGuests(partyId, isAdmin)
  const results = usePartyResults(partyId, isAdmin)
  const roster = usePartyRoster(partyId, isAdmin)
  // "(You)" in the shared list: the host's entry is "host"; a co-host's is a
  // one-way hash of the party and their uid (the roster never holds uids).
  const [coHostId, setCoHostId] = useState<string | null>(null)
  useEffect(() => {
    if (!partyId || !user || isHost || !isAdmin) return
    let cancelled = false
    coHostRosterId(partyId, user.uid)
      .then((id) => !cancelled && setCoHostId(id))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [partyId, user, isHost, isAdmin])
  const myRosterId = isHost ? 'host' : coHostId
  // Parties created before the shared roster existed have no entries yet:
  // build them once from the private records (server-side, admins only).
  const rosterSynced = useRef(false)
  const needsRoster = isAdmin && !roster.loading && !roster.error && !roster.data.some((e) => e.role === 'host')
  useEffect(() => {
    if (!needsRoster || !partyId || rosterSynced.current) return
    rosterSynced.current = true
    syncRoster(partyId).catch((err) => console.error('[party] roster sync', err))
  }, [needsRoster, partyId])
  // The bottle key lives only in memory, fetched on an explicit, confirmed,
  // server-logged request — never a live listener.
  const [bottleKey, setBottleKey] = useState<BottleKey | null>(null)
  const [keyLog, setKeyLog] = useState<KeyAccessEntry[]>([])
  const [coHostLink, setCoHostLink] = useState<string | null>(null)
  // Blind and Dual Experience parties both have a secret bottle key.
  const isBlind = Boolean(party.data && partyFormat(party.data) !== 'regular')
  const refreshKeyLog = useCallback(() => {
    if (!partyId || !isAdmin || !isBlind) return
    getKeyAccessLog(partyId)
      .then(setKeyLog)
      .catch((err) => console.error('[party] key log', err))
  }, [partyId, isAdmin, isBlind])
  useEffect(refreshKeyLog, [refreshKeyLog])
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
  // Dual Experience: the host's own group decides what My Tasting shows. A
  // guided host reads the guided bottles; a blind host never subscribes.
  const hostGroup = party.data && hostGuest ? guestGroup(party.data, hostGuest) : null
  const guided = useGuidedBottles(partyId, tasting && hostGroup === 'guided')
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

  if (authLoading || (user && (party.loading || adminRole.loading))) return <PartyLoading />
  if (!user) return <PartyMessage title="Host dashboard" message="Sign in to your FIP account to run your party." action={<SignInButton />} />
  if (!party.data) return <PartyMessage title="Party not found" message="This party doesn’t exist, or you don’t have access to it." />
  if (!isAdmin) {
    return <PartyMessage title="Hosts only" message="This dashboard belongs to the party’s host and co-hosts." action={<LinkButton to={`/party/${party.data.id}`}>Go to the party</LinkButton>} />
  }

  const p: Party = party.data
  const completed = p.status === 'completed'
  const revealedCount = p.categories.filter((c) => c.state === 'revealed').length
  const closedCount = p.categories.filter((c) => c.state === 'voting_closed').length
  const activeGuests = guests.data.filter((g) => !g.revoked && !g.isHost)
  const regular = partyFormat(p) === 'regular'
  const progress = tasting ? myTastingProgress(p, myBallots.data) : null
  const hostIsTasting = guests.data.some((g) => g.isHost && !g.revoked)
  const coHosts = admins.data.filter((a) => a.role === 'cohost').sort((a, b) => a.addedAt - b.addedAt)
  const adminName = (uid: string) => {
    const admin = admins.data.find((a) => a.uid === uid)
    if (!admin) return 'A former co-host'
    return admin.role === 'host' ? `${p.hostName} (host)` : `${admin.name} (co-host)`
  }
  const dual = partyFormat(p) === 'dual'
  const counts = dual ? groupCounts(roster.data) : null
  // Rounds where the tasting host's own scores won't count as fully blind
  // (a guided host in a dual event isn't tasting blind at all).
  const notBlindRounds = tasting && !regular && hostGroup !== 'guided' ? p.categories.filter((c) => p.hostKeyViews?.[c.id]) : []
  const rosterKeyGroup = (key: string): PartyGroup => {
    const g = guests.data.find((x) => (key === 'host' ? x.isHost : x.participantKey === key))
    return guestGroup(p, g ?? { isHost: key === 'host' }) ?? 'blind'
  }

  // Moving someone who has already scored needs a second, confirmed call;
  // the server answers needsConfirm instead of moving them.
  async function moveGroup(participantKey: string, name: string, group: PartyGroup, confirm = false) {
    const ask: { next: Pending | null } = { next: null }
    await run(async () => {
      const result = await assignPartyGroup(p.id, participantKey, group, confirm)
      if (result.needsConfirm) ask.next = { kind: 'moveGroup', participantKey, name, group, scoredRounds: result.scoredRounds ?? 1 }
    })
    if (ask.next) setPending(ask.next)
  }

  function samplesFor(category: PartyCategory): { label: string; name: string; summary: string }[] | null {
    if (regular) {
      return category.sampleLabels.map((label) => {
        const b = category.bottles?.[label]
        return { label, name: b?.name ?? '—', summary: b ? publicBottleSummary(b) : '' }
      })
    }
    if (!bottleKey) return null
    return (bottleKey.categories[category.id]?.samples ?? []).map((s) => ({ label: s.label, name: s.bottle.name, summary: bottleSummary(s.bottle) }))
  }

  function toggleBottles(category: PartyCategory) {
    if (!regular && !bottleKey && !showBottles[category.id]) {
      setPending({ kind: 'viewKey', categoryId: category.id })
      return
    }
    setShowBottles((s) => ({ ...s, [category.id]: !s[category.id] }))
  }

  async function viewKey(categoryId?: string) {
    const ok = await run(async () => setBottleKey(await getBottleKey(p.id)))
    if (ok && categoryId) setShowBottles((s) => ({ ...s, [categoryId]: true }))
    refreshKeyLog()
  }

  function hideKey() {
    setBottleKey(null)
    setShowBottles({})
  }

  async function inviteCoHost() {
    await run(async () => {
      const { token } = await createCoHostInvite(p.id)
      const url = partyCoHostUrl(p.id, token)
      setCoHostLink(url)
      await shareOrCopy(`Co-host ${p.name}`, 'Help me run this tasting: you’ll set up the bottles and hold the key so I can taste blind.', url)
    })
  }
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
          <span className={styles.eyebrow}>Host dashboard · {dual ? 'Dual Experience' : regular ? 'Regular tasting' : 'Blind tasting'}</span>
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
          <TastingIndicator party={p} entries={roster.data} myRosterId={myRosterId} />
          <MyTastingView
            party={p}
            guest={hostGuest!}
            ballots={myBallots.data}
            results={results.data}
            resumeAtLastSample
            group={hostGroup}
            guidedBottles={guided.data}
          />
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
          {dual && counts ? (
            <>
              <div className={styles.stat}>
                <span className={styles.statValue}>{counts.guided + counts.blind}</span>
                <span className={styles.statLabel}>Tasting</span>
              </div>
              {GROUPS.map((group) => {
                const planned = group === 'guided' ? p.dual?.plannedGuided : p.dual?.plannedBlind
                return (
                  <div key={group} className={styles.stat}>
                    <span className={styles.statValue}>
                      {counts[group]}
                      {planned ? <span className={styles.statLabel}> / {planned}</span> : null}
                    </span>
                    <span className={styles.statLabel}>{GROUP_LABEL[group]}</span>
                  </div>
                )
              })}
            </>
          ) : (
            <div className={styles.stat}>
              <span className={styles.statValue}>{activeGuests.length}</span>
              <span className={styles.statLabel}>Guests</span>
            </div>
          )}
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
                samples={samplesFor(category)}
                progress={dual ? groupProgress(roster.data, category.id) : null}
                showBottles={Boolean(showBottles[category.id])}
                onToggleBottles={() => toggleBottles(category)}
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
            {!regular ? (
              <section className={styles.card} aria-labelledby="key-heading">
                <div className={styles.spread}>
                  <h2 id="key-heading" className={styles.sectionTitle}>
                    Bottle key
                  </h2>
                  {bottleKey ? (
                    <Button variant="ghost" onClick={hideKey}>
                      Hide key
                    </Button>
                  ) : (
                    <Button variant="secondary" disabled={busy} onClick={() => setPending({ kind: 'viewKey' })}>
                      View bottle key
                    </Button>
                  )}
                </div>
                <p className={styles.muted}>
                  Which bottle is behind each letter. Guests never see it before the reveal, and every view before then is logged here.
                </p>
                {notBlindRounds.length ? (
                  <p className={styles.notice} role="note">
                    Your own scores in {notBlindRounds.map((c) => `“${c.name}”`).join(', ')} are marked <strong>not fully blind</strong>: you set up or
                    viewed those bottles before finishing. They still count exactly like everyone else’s.
                  </p>
                ) : null}
                {keyLog.length ? (
                  <ul className={styles.list} aria-label="Bottle key access before reveal">
                    {keyLog.slice(0, 20).map((entry) => (
                      <li key={entry.id} className={styles.listItem}>
                        <span className={styles.grow}>
                          {adminName(entry.actorUid)} · {entry.purpose === 'setup' ? 'editing setup' : 'viewed key'}
                          {entry.flaggedCategoryIds.length ? ' · tasting marked not fully blind' : ''}
                        </span>
                        <span className={styles.muted}>{new Date(entry.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.muted}>No one has viewed the key before a reveal.</p>
                )}
              </section>
            ) : null}

            {isHost ? (
              <section className={styles.card} aria-labelledby="cohost-heading">
                <h2 id="cohost-heading" className={styles.sectionTitle}>
                  Co-host / pour assistant
                </h2>
                <p className={styles.muted}>
                  {regular
                    ? 'Someone to help run the rounds and enter paper ballots.'
                    : 'Want to taste blind too? A co-host sets up the bottles, pours and holds the key, so you never see it. Co-hosts run the event but don’t score.'}
                </p>
                {coHosts.length ? (
                  <ul className={styles.list}>
                    {coHosts.map((c) => (
                      <li key={c.uid} className={styles.listItem}>
                        <span className={`${styles.grow} ${styles.truncate}`}>{c.name}</span>
                        {!completed ? (
                          <Button variant="ghost" aria-label={`Remove co-host ${c.name}`} onClick={() => setPending({ kind: 'removeCoHost', uid: c.uid, name: c.name })}>
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}
                {!completed && coHosts.length < 3 ? (
                  <Button variant="secondary" disabled={busy} onClick={() => void inviteCoHost()}>
                    Invite a co-host
                  </Button>
                ) : null}
                {coHostLink ? (
                  <div className={styles.notice}>
                    Send this one-time link to your co-host (valid 2 days). They’ll need an FIP account.
                    <input className={styles.input} readOnly value={coHostLink} onFocus={(e) => e.currentTarget.select()} aria-label="Co-host invite link" style={{ marginTop: 8 }} />
                  </div>
                ) : null}
              </section>
            ) : (
              <p className={styles.notice}>You’re a co-host for {p.hostName}’s party. You can run rounds and hold the bottle key, but co-hosts don’t score.</p>
            )}

            <WhoIsTasting party={p} entries={roster.data} myRosterId={myRosterId} loading={roster.loading} />

            <InvitePanel party={p} />

            {/* Admin controls, kept apart from the shared, read-only list above. */}
            <section className={styles.card} aria-labelledby="participants-heading">
              <div className={styles.spread}>
                <h2 id="participants-heading" className={styles.sectionTitle}>
                  Participants
                </h2>
                <span className={styles.pill}>
                  {activeGuests.length}
                  {p.capacity ? ` / ${p.capacity}` : ''}
                </span>
              </div>
              <div className={`${styles.listItem} ${dual ? styles.participantRow : ''}`}>
                <span className={`${styles.grow} ${dual ? styles.participantName : styles.truncate}`}>
                  {p.hostName} {isHost ? '(you)' : '(host)'} · {hostIsTasting ? 'tasting too' : 'hosting only'}
                </span>
                {dual && hostIsTasting ? (
                  <GroupSwitch
                    name={p.hostName}
                    group={rosterKeyGroup('host')}
                    disabled={busy || completed || !isHost}
                    onChange={(group) => void moveGroup('host', isHost ? 'you' : p.hostName, group)}
                  />
                ) : null}
                {!completed && isHost ? (
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
                      <li key={g.uid} className={`${styles.listItem} ${dual ? styles.participantRow : ''}`}>
                        <span className={`${styles.grow} ${dual ? styles.participantName : styles.truncate}`}>
                          {g.nickname}
                          {g.uid === user.uid ? ' (you)' : ''}
                        </span>
                        {dual ? (
                          <GroupSwitch
                            name={g.nickname}
                            group={guestGroup(p, g) ?? 'blind'}
                            disabled={busy || completed}
                            onChange={(group) => void moveGroup(g.participantKey, g.nickname, group)}
                          />
                        ) : null}
                        {!completed && g.uid !== user.uid ? (
                          <Button variant="ghost" aria-label={`Remove ${g.nickname}`} onClick={() => setPending({ kind: 'removeGuest', uid: g.uid, nickname: g.nickname })}>
                            Remove
                          </Button>
                        ) : null}
                      </li>
                    ))}
                </ul>
              )}
              {dual ? (
                <p className={styles.muted}>
                  New guests start in {GROUP_LABEL[p.dual?.joinGroup ?? 'blind']}. Move people before they start scoring; moving someone who has scored asks
                  you to confirm and keeps their scores. Anyone moved from Guided to Blind has seen the bottles, so their blind scores are marked not fully
                  blind.
                </p>
              ) : null}
              <p className={styles.muted}>
                Everyone in the party sees names in Who’s Tasting; only you and your co-hosts can remove someone.{' '}
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

            {isHost ? (
              <section className={styles.card}>
                <Button variant="danger" onClick={() => setPending({ kind: 'delete' })}>
                  Delete party
                </Button>
              </section>
            ) : null}
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
          message={
            dual
              ? 'All closed rounds reveal at once. Blind tasters see the bottles, and everyone sees the rankings and the Guided vs. Blind comparison.'
              : 'All closed rounds reveal at once, with their rankings.'
          }
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
      {pending?.kind === 'viewKey' ? (
        <ConfirmDialog
          title="Show the bottle key?"
          message={
            tasting && hostGroup === 'guided'
              ? 'You’re tasting in the guided group, so this doesn’t change your scores. Views before the reveal are logged for the host and co-hosts to see.'
              : tasting && p.categories.some((c) => c.state !== 'revealed')
              ? 'You’re tasting too. Seeing the key marks your scores as not fully blind in every unrevealed round you haven’t finished scoring. They still count equally. This view is logged.'
              : 'This shows which bottle is behind each letter in every round. Views before the reveal are logged for the host and co-hosts to see.'
          }
          confirmLabel="Show bottle key"
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void viewKey(pending.categoryId)}
        />
      ) : null}
      {pending?.kind === 'removeCoHost' ? (
        <ConfirmDialog
          title={`Remove ${pending.name} as co-host?`}
          message="They lose access to the dashboard and the bottle key right away."
          confirmLabel="Remove co-host"
          danger
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => run(() => removeCoHost(p.id, pending.uid))}
        />
      ) : null}
      {pending?.kind === 'moveGroup' ? (
        <ConfirmDialog
          title={`Move ${pending.name} to ${GROUP_LABEL[pending.group]}?`}
          message={`${pending.name === 'you' ? 'You’ve' : `${pending.name} has`} already scored ${pending.scoredRounds === 1 ? 'a round' : `${pending.scoredRounds} rounds`} that ${pending.scoredRounds === 1 ? 'isn’t' : 'aren’t'} revealed yet. Those scores move with ${pending.name === 'you' ? 'you' : 'them'} and count in the ${GROUP_LABEL[pending.group]} group.${pending.group === 'blind' ? ' Because the bottles were visible in Guided, those blind scores are marked not fully blind. They still count.' : ''}`}
          confirmLabel={`Move to ${GROUP_LABEL[pending.group]}`}
          busy={busy}
          onCancel={() => setPending(null)}
          onConfirm={() => void moveGroup(pending.participantKey, pending.name, pending.group, true)}
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
  samples,
  showBottles,
  onToggleBottles,
  onAction,
  onMakeCurrent,
  onShowResults,
  resultsOpen,
  busy,
  disabled,
  progress = null,
  children,
}: {
  index: number
  party: Party
  category: PartyCategory
  samples: { label: string; name: string; summary: string }[] | null
  showBottles: boolean
  onToggleBottles: () => void
  onAction: (to: PartyCategoryState) => void
  onMakeCurrent: () => void
  onShowResults: () => void
  resultsOpen: boolean
  busy: boolean
  disabled: boolean
  // Dual Experience: this round's submissions, per group.
  progress?: Record<PartyGroup, GroupProgress> | null
  children?: ReactNode
}) {
  const counts = ballotCount(party, category.id)
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
      {progress && category.state !== 'draft' && category.state !== 'ready' ? (
        <div className={styles.row} aria-label="Submissions by group">
          {GROUPS.map((group) => (
            <span key={group} className={`${styles.pill} ${progress[group].total && progress[group].submitted === progress[group].total ? styles.pillDone : ''}`}>
              {GROUP_LABEL[group]}: {progress[group].submitted} of {progress[group].total} submitted
            </span>
          ))}
        </div>
      ) : null}
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
          {regular ? (showBottles ? 'Hide bottles' : 'Show bottles') : showBottles ? 'Hide bottle key' : 'Show bottle key'}
        </Button>
        {category.state === 'revealed' ? (
          <Button variant="ghost" onClick={onShowResults} aria-expanded={resultsOpen}>
            {resultsOpen ? 'Hide results' : 'View results'}
          </Button>
        ) : null}
      </div>
      {showBottles && samples ? (
        samples.length ? (
          <ul className={styles.list}>
            {samples.map((s) => (
              <li key={s.label} className={styles.listItem}>
                <span className={`${styles.sampleBadge} ${styles.sampleBadgeSmall}`} aria-hidden="true">
                  {s.label}
                </span>
                <div className={styles.grow}>
                  <div className={styles.truncate}>
                    <span className={styles.srOnly}>Sample {s.label}: </span>
                    {s.name}
                  </div>
                  <div className={`${styles.muted} ${styles.truncate}`}>{s.summary}</div>
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

// Guided / Blind for one taster on the host dashboard.
function GroupSwitch({ name, group, disabled, onChange }: { name: string; group: PartyGroup; disabled: boolean; onChange: (group: PartyGroup) => void }) {
  return (
    <div className={styles.groupSwitch} role="radiogroup" aria-label={`${name}’s group`}>
      {GROUPS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={group === g}
          className={styles.groupOption}
          disabled={disabled}
          onClick={() => group !== g && onChange(g)}
        >
          {GROUP_LABEL[g]}
        </button>
      ))}
    </div>
  )
}
