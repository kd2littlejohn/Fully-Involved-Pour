import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../../components/layout/PageHeader'
import { EmptyState } from '../../components/ui/EmptyState'
import { Button } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { TapChip } from '../../components/ui/TapChip'
import { BottlePlaceholder } from '../../components/ui/BottlePlaceholder'
import { RaritySuggestionPanel, type RaritySuggestionPanelState } from '../../features/rarity/RaritySuggestionPanel'
import { RARITY_OPTIONS } from '../../features/rarity/rarityLevels'
import { isRarityConfirmed } from '../../features/rarity/rarityFields'
import { selectRarityReviewQueue, needsFetch, highConfidenceAcceptableIds } from '../../features/rarity/rarityReviewQueue'
import { runWithConcurrency, RARITY_REVIEW_CONCURRENCY } from '../../features/rarity/runWithConcurrency'
import { requestRaritySuggestion, rarityIdentity, type RaritySuggestionOutcome } from '../../data/repositories/rarity'
import { BULK_PARTIAL_FAILURE_MESSAGE, rarityErrorMessage } from '../../features/rarity/rarityErrors'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import type { Bottle, BottleRarity, RaritySuggestion } from '../../data/types'
import styles from './RarityReviewPage.module.css'

type FailureKind = 'failed' | 'unavailable'

export function RarityReviewPage() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, acceptRaritySuggestions, storeRaritySuggestions, setBottleRarity } = useUserData()

  // The set of bottles under review is frozen the moment real data first
  // arrives — accepting/dismissing a row mid-run must never reshuffle the
  // list out from under the user. Each row's own DATA still reads live
  // from userDoc below, so a freshly-fetched or freshly-accepted suggestion
  // shows up immediately; only which bottles are in the list is frozen.
  const queueIdsRef = useRef<string[] | null>(null)
  if (queueIdsRef.current === null && !dataLoading) {
    queueIdsRef.current = selectRarityReviewQueue(userDoc.bottles).map((b) => b.id)
  }
  const queueIds = queueIdsRef.current ?? []

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [changingIds, setChangingIds] = useState<Set<string>>(new Set())
  const [failures, setFailures] = useState<Map<string, FailureKind>>(new Map())
  const [processedCount, setProcessedCount] = useState(0)
  const [toFetchCount, setToFetchCount] = useState(0)
  const [running, setRunning] = useState(false)
  const [halted, setHalted] = useState(false)
  const [confirmingAcceptAll, setConfirmingAcceptAll] = useState(false)
  const [acceptingAll, setAcceptingAll] = useState(false)

  useEffect(() => {
    if (queueIds.length === 0) return
    let cancelled = false
    const startingBottles = queueIds.map((id) => userDoc.bottles.find((b) => b.id === id)).filter((b): b is Bottle => Boolean(b))
    const toFetch = startingBottles.filter(needsFetch)
    setToFetchCount(toFetch.length)
    if (toFetch.length === 0) return

    setRunning(true)
    let pending: { bottleId: string; suggestion: RaritySuggestion }[] = []

    async function flush() {
      if (pending.length === 0) return
      const batch = pending
      pending = []
      await storeRaritySuggestions(batch)
    }

    let localHalted = false

    async function worker(bottle: Bottle) {
      const outcome: RaritySuggestionOutcome = await requestRaritySuggestion(rarityIdentity(bottle), bottle.raritySuggestion)
      if (cancelled) return
      setProcessedCount((c) => c + 1)
      if (outcome.status === 'ready') {
        pending.push({ bottleId: bottle.id, suggestion: outcome.suggestion })
        if (pending.length >= RARITY_REVIEW_CONCURRENCY) void flush()
      } else if (outcome.status === 'unavailable') {
        // Halt the rest of the queue rather than burning through further
        // rate-limited calls — surfaced via `halted` below.
        localHalted = true
        setHalted(true)
        setFailures((prev) => new Map(prev).set(bottle.id, 'unavailable'))
      } else {
        // A transient failure is never persisted, so it's simply retried
        // on the next review run rather than getting stuck forever.
        setFailures((prev) => new Map(prev).set(bottle.id, 'failed'))
      }
    }

    runWithConcurrency(toFetch, RARITY_REVIEW_CONCURRENCY, worker, undefined, () => cancelled || localHalted)
      .then(() => flush())
      .then(() => {
        if (!cancelled) setRunning(false)
      })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs exactly once against the frozen queue
  }, [queueIds.length])

  if (authLoading || dataLoading) {
    return <PageHeader eyebrow="My Bar" title="Review Rarity Suggestions" />
  }

  const rows = queueIds
    .map((id) => userDoc.bottles.find((b) => b.id === id))
    .filter((b): b is Bottle => Boolean(b))
    .filter((b) => !isRarityConfirmed(b))
    .filter((b) => !dismissedIds.has(b.id))

  const acceptableIds = highConfidenceAcceptableIds(rows)

  function panelStateFor(bottle: Bottle): RaritySuggestionPanelState {
    const failure = failures.get(bottle.id)
    if (failure) return failure
    if (needsFetch(bottle)) return running ? 'loading' : 'idle'
    return 'ready'
  }

  function handleLeaveUnclassified(bottleId: string) {
    setDismissedIds((prev) => new Set(prev).add(bottleId))
  }

  function toggleChanging(bottleId: string) {
    setChangingIds((prev) => {
      const next = new Set(prev)
      if (next.has(bottleId)) next.delete(bottleId)
      else next.add(bottleId)
      return next
    })
  }

  async function handleSelectRarity(bottleId: string, rarity: BottleRarity) {
    setChangingIds((prev) => {
      const next = new Set(prev)
      next.delete(bottleId)
      return next
    })
    await setBottleRarity(bottleId, rarity)
  }

  async function handleAcceptAll() {
    setAcceptingAll(true)
    await acceptRaritySuggestions(acceptableIds)
    setAcceptingAll(false)
    setConfirmingAcceptAll(false)
  }

  if (!user) {
    return (
      <>
        <PageHeader eyebrow="My Bar" title="Review Rarity Suggestions" />
        <EmptyState title="Sign in to continue." message="Sign in to review rarity suggestions for your bar." />
      </>
    )
  }

  if (rows.length === 0) {
    return (
      <>
        <PageHeader eyebrow="My Bar" title="Review Rarity Suggestions" />
        <EmptyState title="Nothing to review." message="Every owned bottle already has a confirmed rarity." action={<Button onClick={() => navigate('/collection')}>Back to My Bar</Button>} />
      </>
    )
  }

  return (
    <>
      <PageHeader eyebrow="My Bar" title="Review Rarity Suggestions" subtitle="Accept a suggestion, choose a different level, or leave it for later." />

      <div className={styles.page}>
        {toFetchCount > 0 ? (
          <p className={styles.progress}>
            {running ? 'Suggesting…' : 'Done.'} {processedCount} of {toFetchCount}
          </p>
        ) : null}

        {halted ? <p className={styles.error}>{rarityErrorMessage({ status: 'unavailable' })} Try again later.</p> : null}
        {!halted && failures.size > 0 && !running ? <p className={styles.error}>{BULK_PARTIAL_FAILURE_MESSAGE}</p> : null}

        {acceptableIds.length > 0 ? (
          <Button onClick={() => setConfirmingAcceptAll(true)} className={styles.acceptAllButton}>
            Accept All High-Confidence Suggestions ({acceptableIds.length})
          </Button>
        ) : null}

        <div className={styles.list}>
          {rows.map((bottle) => (
            <div key={bottle.id} className={styles.row}>
              <div className={styles.rowMain}>
                {bottle.imageUrl ? (
                  <img src={bottle.imageUrl} alt="" className={styles.image} />
                ) : (
                  <div className={styles.image}>
                    <BottlePlaceholder name={bottle.name} compact />
                  </div>
                )}
                <div className={styles.rowInfo}>
                  <p className={styles.rowName}>{bottle.name}</p>
                  {bottle.distillery ? <p className={styles.rowDistillery}>{bottle.distillery}</p> : null}
                </div>
              </div>

              {changingIds.has(bottle.id) ? (
                <div className={styles.chipRow}>
                  {RARITY_OPTIONS.map((option) => (
                    <TapChip key={option.value} label={option.label} active={false} onToggle={() => void handleSelectRarity(bottle.id, option.value)} />
                  ))}
                </div>
              ) : (
                <RaritySuggestionPanel
                  state={panelStateFor(bottle)}
                  suggestion={bottle.raritySuggestion}
                  onAccept={() => void acceptRaritySuggestions([bottle.id])}
                  onChoose={() => toggleChanging(bottle.id)}
                />
              )}

              <div className={styles.rowActions}>
                <Button variant="ghost" onClick={() => toggleChanging(bottle.id)}>
                  {changingIds.has(bottle.id) ? 'Cancel' : 'Change'}
                </Button>
                <Button variant="ghost" onClick={() => handleLeaveUnclassified(bottle.id)}>
                  Leave Unclassified
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {confirmingAcceptAll ? (
        <Modal title="Accept all high-confidence suggestions?" onClose={() => (acceptingAll ? undefined : setConfirmingAcceptAll(false))}>
          <p className={styles.confirmText}>
            This confirms rarity for {acceptableIds.length} {acceptableIds.length === 1 ? 'bottle' : 'bottles'} using each one&rsquo;s high-confidence
            suggestion. Medium- and low-confidence suggestions are left for individual review.
          </p>
          <div className={styles.modalActions}>
            <Button variant="ghost" onClick={() => setConfirmingAcceptAll(false)} disabled={acceptingAll}>
              Cancel
            </Button>
            <Button onClick={() => void handleAcceptAll()} disabled={acceptingAll}>
              {acceptingAll ? 'Accepting…' : 'Accept All'}
            </Button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
