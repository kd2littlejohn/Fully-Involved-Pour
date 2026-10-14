import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { LinkButton } from '../../components/ui/LinkButton'
import { SignInButton } from '../../components/domain/SignInButton'
import { useAuth } from '../../hooks/useAuth'
import { PartyLoading, PartyMessage, PartyPage } from '../../features/party/PartyChrome'
import { ConfirmDialog } from '../../features/party/ConfirmDialog'
import { useParty } from '../../features/party/usePartyData'
import { ballotCount, categoryStateLabel, formatScore } from '../../features/party/partyLabels'
import { deletePaperBallot, listBallots, partyErrorMessage, savePaperBallot, setBallotExcluded } from '../../data/repositories/party'
import type { PartyBallotSummary, PartyCategory } from '../../features/party/types'
import styles from '../../features/party/party.module.css'

interface FormState {
  ballotId?: string
  ballotNumber: string
  nickname: string
  scores: Record<string, string>
  favoriteLabel: string
  predictionLabel: string
}

const emptyForm = (): FormState => ({ ballotNumber: '', nickname: '', scores: {}, favoriteLabel: '', predictionLabel: '' })

function parseScore(raw: string): number | null | 'invalid' {
  if (!raw.trim()) return null
  const value = Number(raw.replace(',', '.'))
  if (!Number.isFinite(value) || value < 0 || value > 10) return 'invalid'
  return Math.round(value * 10) / 10
}

// Host-only entry for guests who'd rather score on paper. Paper ballots
// count exactly like digital ones; every entry, edit and deletion is
// recorded in the party's audit log on the server.
export function PaperBallotsPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const { user, loading: authLoading } = useAuth()
  const party = useParty(partyId, Boolean(user))
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [ballots, setBallots] = useState<PartyBallotSummary[]>([])
  const [form, setForm] = useState<FormState>(emptyForm)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState<{ newBallotId: string; nickname: string; digitalBallotId: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<PartyBallotSummary | null>(null)

  const p = party.data
  const isHost = Boolean(user && p && p.hostUid === user.uid)
  const enterable = (c: PartyCategory) => c.state === 'voting_open' || c.state === 'voting_closed'
  const category = p?.categories.find((c) => c.id === categoryId) ?? p?.categories.find(enterable) ?? p?.categories[0]

  const livePartyId = p?.id
  const liveCategoryId = category?.id
  const refresh = useCallback(async () => {
    if (!livePartyId || !liveCategoryId || !isHost) return
    try {
      const result = await listBallots(livePartyId, liveCategoryId)
      setBallots(result.ballots)
    } catch (err) {
      setError(partyErrorMessage(err))
    }
  }, [livePartyId, liveCategoryId, isHost])

  // Re-list whenever this round's ballot counts move (a guest submits).
  const countsKey = liveCategoryId && p ? `${p.counts?.digital?.[liveCategoryId] ?? 0}:${p.counts?.paper?.[liveCategoryId] ?? 0}` : ''
  useEffect(() => {
    void refresh()
  }, [refresh, countsKey])

  if (authLoading || (user && party.loading)) return <PartyLoading />
  if (!user) return <PartyMessage title="Paper ballots" message="Sign in as the host to enter paper ballots." action={<SignInButton />} />
  if (!p || !isHost) return <PartyMessage title="Hosts only" message="Only the party’s host can enter paper ballots." />

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!category) return
    const scores: Record<string, { overall: number }> = {}
    for (const label of category.sampleLabels) {
      const parsed = parseScore(form.scores[label] ?? '')
      if (parsed === 'invalid') {
        setError(`Sample ${label}: enter a score from 0 to 10.`)
        return
      }
      if (parsed !== null) scores[label] = { overall: parsed }
    }
    if (!Object.keys(scores).length) {
      setError('Enter at least one sample’s score.')
      return
    }
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const result = await savePaperBallot(p!.id, category.id, {
        ...(form.ballotId ? { ballotId: form.ballotId } : {}),
        ballotNumber: form.ballotNumber.trim(),
        nickname: form.nickname.trim(),
        scores,
        favoriteLabel: form.favoriteLabel || null,
        predictionLabel: p!.settings.predictions ? form.predictionLabel || null : null,
      })
      setMessage(form.ballotId ? 'Ballot updated.' : `Ballot ${form.ballotNumber || form.nickname} saved.`)
      if (result.possibleDuplicateOf) {
        setDuplicate({ newBallotId: result.ballotId, nickname: result.possibleDuplicateOf.nickname, digitalBallotId: result.possibleDuplicateOf.ballotId })
      }
      setForm(emptyForm())
      await refresh()
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  async function exclude(ballotId: string, excluded: boolean, reason?: string) {
    setError(null)
    try {
      await setBallotExcluded(p!.id, ballotId, excluded, reason)
      await refresh()
    } catch (err) {
      setError(partyErrorMessage(err))
    }
  }

  function edit(ballot: PartyBallotSummary) {
    setForm({
      ballotId: ballot.id,
      ballotNumber: ballot.ballotNumber,
      nickname: ballot.nickname,
      scores: Object.fromEntries(Object.entries(ballot.scores ?? {}).map(([l, s]) => [l, String(s.overall)])),
      favoriteLabel: ballot.favoriteLabel ?? '',
      predictionLabel: ballot.predictionLabel ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const counts = category ? ballotCount(p, category.id) : { paper: 0, digital: 0, total: 0 }
  const paper = ballots.filter((b) => b.source === 'paper')
  const digital = ballots.filter((b) => b.source === 'digital')
  const canEnter = category ? enterable(category) && p.status !== 'completed' : false

  return (
    <PartyPage back={{ to: `/party/${p.id}/host`, label: 'Dashboard' }}>
      <section className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        <span className={styles.eyebrow}>Paper Ballot Entry</span>
        <h1 className={styles.title}>{p.name}</h1>
        <LinkButton to={`/party/${p.id}/print`} variant="secondary">
          Print blank scorecards
        </LinkButton>
      </section>

      <label className={styles.label} htmlFor="ballot-round">
        Round
      </label>
      <select
        id="ballot-round"
        className={styles.input}
        value={category?.id ?? ''}
        onChange={(e) => {
          setCategoryId(e.target.value)
          setForm(emptyForm())
          setMessage(null)
        }}
      >
        {p.categories.map((c, i) => (
          <option key={c.id} value={c.id}>
            {i + 1}. {c.name} — {categoryStateLabel(c.state)}
          </option>
        ))}
      </select>

      {category ? (
        <>
          <div className={styles.statRow}>
            <div className={styles.stat}>
              <span className={styles.statValue}>{counts.paper}</span>
              <span className={styles.statLabel}>Paper ballots</span>
            </div>
            <div className={styles.stat}>
              <span className={styles.statValue}>{counts.digital}</span>
              <span className={styles.statLabel}>Digital ballots</span>
            </div>
          </div>

          {!canEnter ? (
            <p className={styles.notice}>
              {category.state === 'revealed' || p.status === 'completed'
                ? 'This round is revealed, so its ballots are final.'
                : 'Open voting for this round before entering paper ballots.'}
            </p>
          ) : (
            <form className={styles.card} onSubmit={submit} aria-labelledby="entry-heading">
              <h2 id="entry-heading" className={styles.sectionTitle}>
                {form.ballotId ? 'Edit ballot' : 'Enter a ballot'}
              </h2>
              <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                  <label className={styles.label} htmlFor="ballot-number">
                    Ballot #
                  </label>
                  <input id="ballot-number" className={styles.input} maxLength={12} value={form.ballotNumber} onChange={(e) => setForm({ ...form, ballotNumber: e.target.value })} />
                </div>
                <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                  <label className={styles.label} htmlFor="ballot-nickname">
                    Guest nickname
                  </label>
                  <input id="ballot-nickname" className={styles.input} maxLength={24} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} />
                </div>
              </div>
              <span className={styles.label}>Overall enjoyment (0–10). Leave blank if a sample wasn’t scored.</span>
              <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))' }}>
                {category.sampleLabels.map((label) => (
                  <div key={label} className={styles.stack} style={{ gap: 'var(--fip-space-1)', alignItems: 'center' }}>
                    <label htmlFor={`paper-${label}`} className={`${styles.sampleBadge} ${styles.sampleBadgeSmall}`}>
                      <span className={styles.srOnly}>Sample </span>
                      {label}
                    </label>
                    <input
                      id={`paper-${label}`}
                      className={styles.input}
                      style={{ textAlign: 'center' }}
                      inputMode="decimal"
                      value={form.scores[label] ?? ''}
                      onChange={(e) => setForm({ ...form, scores: { ...form.scores, [label]: e.target.value } })}
                    />
                  </div>
                ))}
              </div>
              <div className={styles.grid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))' }}>
                <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                  <label className={styles.label} htmlFor="paper-favorite">
                    Favorite
                  </label>
                  <select id="paper-favorite" className={styles.input} value={form.favoriteLabel} onChange={(e) => setForm({ ...form, favoriteLabel: e.target.value })}>
                    <option value="">None</option>
                    {category.sampleLabels.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
                {p.settings.predictions ? (
                  <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                    <label className={styles.label} htmlFor="paper-prediction">
                      Prediction
                    </label>
                    <select id="paper-prediction" className={styles.input} value={form.predictionLabel} onChange={(e) => setForm({ ...form, predictionLabel: e.target.value })}>
                      <option value="">None</option>
                      {category.sampleLabels.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
              <div className={styles.row}>
                <Button type="submit" disabled={busy || (!form.ballotNumber.trim() && !form.nickname.trim())}>
                  {busy ? 'Saving…' : form.ballotId ? 'Save changes' : 'Save ballot'}
                </Button>
                {form.ballotId ? (
                  <Button variant="secondary" onClick={() => setForm(emptyForm())}>
                    Cancel edit
                  </Button>
                ) : null}
              </div>
            </form>
          )}

          <div aria-live="polite">
            {message ? <p className={styles.muted}>{message}</p> : null}
            {error ? (
              <p className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>

          {duplicate ? (
            <div className={styles.notice} role="alert">
              <p>
                <strong>{duplicate.nickname}</strong> also voted on their phone this round. Which ballot should count?
              </p>
              <div className={styles.row} style={{ marginTop: 8 }}>
                <Button variant="secondary" onClick={() => exclude(duplicate.digitalBallotId, true, 'Duplicate of paper ballot').then(() => setDuplicate(null))}>
                  Keep paper
                </Button>
                <Button variant="secondary" onClick={() => exclude(duplicate.newBallotId, true, 'Duplicate of digital ballot').then(() => setDuplicate(null))}>
                  Keep digital
                </Button>
                <Button variant="ghost" onClick={() => setDuplicate(null)}>
                  They’re different people
                </Button>
              </div>
            </div>
          ) : null}

          <section className={styles.card} aria-labelledby="paper-list-heading">
            <h2 id="paper-list-heading" className={styles.sectionTitle}>
              Paper ballots ({paper.length})
            </h2>
            {paper.length === 0 ? <p className={styles.muted}>None entered yet.</p> : null}
            <ul className={styles.list}>
              {paper.map((b) => (
                <li key={b.id} className={styles.listItem} style={{ opacity: b.excluded ? 0.55 : 1 }}>
                  <div className={styles.grow}>
                    <div>
                      {b.ballotNumber ? `#${b.ballotNumber}` : ''} {b.nickname}
                      {b.excluded ? <span className={styles.pill}> Not counted</span> : null}
                      {b.revision > 1 ? <span className={styles.muted}> · edited</span> : null}
                    </div>
                    <div className={styles.muted}>
                      {category.sampleLabels.map((l) => `${l} ${formatScore(b.scores?.[l]?.overall)}`).join(' · ')}
                      {b.favoriteLabel ? ` · ★ ${b.favoriteLabel}` : ''}
                    </div>
                  </div>
                  {canEnter ? (
                    <div className={styles.row}>
                      <Button variant="ghost" onClick={() => edit(b)} aria-label={`Edit ballot ${b.ballotNumber || b.nickname}`}>
                        Edit
                      </Button>
                      <Button variant="ghost" onClick={() => exclude(b.id, !b.excluded, b.excluded ? undefined : 'Excluded by host')}>
                        {b.excluded ? 'Count it' : 'Don’t count'}
                      </Button>
                      <Button variant="ghost" onClick={() => setConfirmDelete(b)} aria-label={`Delete ballot ${b.ballotNumber || b.nickname}`}>
                        Delete
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.card} aria-labelledby="digital-list-heading">
            <h2 id="digital-list-heading" className={styles.sectionTitle}>
              Digital ballots ({digital.length})
            </h2>
            <p className={styles.muted}>Guests’ scores stay private until reveal — you can only see who voted, and stop a duplicate from counting.</p>
            <ul className={styles.list}>
              {digital.map((b) => (
                <li key={b.id} className={styles.listItem} style={{ opacity: b.excluded ? 0.55 : 1 }}>
                  <div className={styles.grow}>
                    {b.nickname} <span className={styles.muted}>· {b.scoredCount} scored{b.hasFavorite ? ' · favorite picked' : ''}</span>
                    {b.excluded ? <span className={styles.pill}> Not counted</span> : null}
                  </div>
                  {canEnter ? (
                    <Button variant="ghost" onClick={() => exclude(b.id, !b.excluded, b.excluded ? undefined : 'Excluded by host')}>
                      {b.excluded ? 'Count it' : 'Don’t count'}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : (
        <p className={styles.muted}>This party has no rounds yet.</p>
      )}

      {confirmDelete ? (
        <ConfirmDialog
          title="Delete this ballot?"
          message={`Ballot ${confirmDelete.ballotNumber ? `#${confirmDelete.ballotNumber}` : ''} ${confirmDelete.nickname} will be removed from the results. The deletion is recorded in the party log.`}
          confirmLabel="Delete ballot"
          danger
          busy={busy}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={async () => {
            setBusy(true)
            try {
              await deletePaperBallot(p.id, confirmDelete.id)
              setMessage('Ballot deleted.')
              await refresh()
            } catch (err) {
              setError(partyErrorMessage(err))
            } finally {
              setBusy(false)
              setConfirmDelete(null)
            }
          }}
        />
      ) : null}
    </PartyPage>
  )
}
