import { useEffect, useMemo, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { TapChip } from '../../components/ui/TapChip'
import { ScoreInput } from './ScoreInput'
import { saveBallot, partyErrorMessage } from '../../data/repositories/party'
import {
  clearScoreDraft,
  loadScoreDraft,
  recallLastSample,
  recallScoringMode,
  rememberLastSample,
  rememberScoringMode,
  saveScoreDraft,
} from './guestSession'
import {
  DETAILED_DESCRIPTOR_GROUPS,
  DETAILED_FIELDS,
  QUICK_DESCRIPTORS,
  draftFromBallot,
  enjoymentWord,
  mergeDrafts,
  sampleChanged,
  toServerScore,
  type RoundDraft,
  type SampleDraft,
} from './scoringModel'
import type { Party, PartyBallot, PartyCategory, PartyPublicBottle, PartySampleScore, PartyScoringMode } from './types'
import { publicBottleSummary } from './partyBottle'
import { LearnAboutThisPour } from './LearnAboutThisPour'
import styles from './party.module.css'
import s from './scoring.module.css'

interface ScoringPanelProps {
  party: Party
  category: PartyCategory
  ballot: PartyBallot | undefined
  // Scroll back to the sample last worked on (the host's My Tasting, after
  // switching away to manage the party and coming back).
  resumeAtLastSample?: boolean
  // Dual Experience guided tasters: this round's bottles, from the guided
  // view only they can read, plus "Learn About This Pour". Blind tasters
  // never get either, so nothing about a bottle reaches their screen.
  guidedBottles?: Record<string, PartyPublicBottle>
}

// A guest's digital ballot for the open round. Quick and Detailed share one
// draft, so switching never drops anything; unsent edits are also kept on
// this device so a refresh mid-pour loses nothing.
export function ScoringPanel({ party, category, ballot, resumeAtLastSample = false, guidedBottles }: ScoringPanelProps) {
  const labels = category.sampleLabels
  // Regular tastings carry bottles on the round itself; dual guided tasters
  // get them from the guided view. Blind rounds have neither.
  const bottles = guidedBottles ?? category.bottles
  const locked = party.settings?.allowEdits === false
  const [mode, setMode] = useState<PartyScoringMode>(() => recallScoringMode() ?? party.settings?.defaultScoring ?? 'quick')
  const [draft, setDraft] = useState<RoundDraft>(() =>
    mergeDrafts(draftFromBallot(labels, ballot), loadScoreDraft<RoundDraft>(party.id, category.id)),
  )
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // A different round (or a ballot arriving for the first time) resets
  // the draft; later ballot updates are our own saves echoing back.
  const draftKey = `${category.id}:${ballot ? 'b' : 'n'}`
  const [initializedFor, setInitializedFor] = useState(draftKey)
  useEffect(() => {
    if (initializedFor === draftKey) return
    setDraft(mergeDrafts(draftFromBallot(labels, ballot), loadScoreDraft<RoundDraft>(party.id, category.id)))
    setInitializedFor(draftKey)
  }, [draftKey, initializedFor, labels, ballot, party.id, category.id])

  useEffect(() => {
    saveScoreDraft(party.id, category.id, draft)
  }, [draft, party.id, category.id])

  useEffect(() => {
    if (!resumeAtLastSample) return
    const label = recallLastSample(party.id, category.id)
    if (label) document.getElementById(`sample-${label}`)?.scrollIntoView?.({ block: 'center' })
    // Only on first mount for this round.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category.id])

  const saved = ballot?.scores ?? {}
  const scoredCount = labels.filter((l) => saved[l]).length
  const pending = useMemo(() => labels.filter((l) => sampleChanged(draft.samples[l]!, saved[l], mode)), [labels, draft, saved, mode])
  const favoriteDirty = draft.favoriteLabel !== (ballot?.favoriteLabel ?? null) && !(locked && ballot?.favoriteLabel)
  const predictionDirty = party.settings?.predictions && draft.predictionLabel !== (ballot?.predictionLabel ?? null) && !(locked && ballot?.predictionLabel)

  function updateSample(label: string, patch: Partial<SampleDraft>) {
    rememberLastSample(party.id, category.id, label)
    setDraft((d) => ({ ...d, samples: { ...d.samples, [label]: { ...d.samples[label]!, ...patch } } }))
  }

  function switchMode(next: PartyScoringMode) {
    setMode(next)
    rememberScoringMode(next)
  }

  async function submit(onlyLabel?: string) {
    const targets = onlyLabel ? [onlyLabel] : pending
    const scores: Record<string, PartySampleScore> = {}
    for (const label of targets) {
      const score = toServerScore(draft.samples[label]!, mode)
      if (score) scores[label] = score
    }
    if (!Object.keys(scores).length && !favoriteDirty && !predictionDirty) return
    setSaving(onlyLabel ?? 'all')
    setError(null)
    try {
      const result = await saveBallot({
        partyId: party.id,
        categoryId: category.id,
        mode,
        scores,
        favoriteLabel: draft.favoriteLabel,
        predictionLabel: party.settings?.predictions ? draft.predictionLabel : null,
      })
      if (locked) {
        // With edits off the server keeps the first submitted values;
        // mirror what it actually stored.
        const stored = draftFromBallot(
          labels.filter((l) => result.scores[l]),
          { scores: result.scores, favoriteLabel: result.favoriteLabel, predictionLabel: result.predictionLabel } as PartyBallot,
        )
        setDraft((d) => ({
          samples: { ...d.samples, ...stored.samples },
          favoriteLabel: result.favoriteLabel ?? d.favoriteLabel,
          predictionLabel: result.predictionLabel ?? d.predictionLabel,
        }))
      }
      setAnnouncement(onlyLabel ? `Sample ${onlyLabel} saved.` : 'Scores saved.')
      if (labels.every((l) => result.scores[l])) clearScoreDraft(party.id, category.id)
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setSaving(null)
    }
  }

  const descriptorsFor = (mode: PartyScoringMode) => (mode === 'quick' ? [{ id: 'quick', label: '', descriptors: QUICK_DESCRIPTORS }] : DETAILED_DESCRIPTOR_GROUPS)

  return (
    <div className={styles.stack} style={{ gap: 'var(--fip-space-4)' }}>
      <div className={styles.spread}>
        <div className={s.modeSwitch} role="radiogroup" aria-label="Scoring style">
          <button type="button" role="radio" aria-checked={mode === 'quick'} className={s.modeButton} onClick={() => switchMode('quick')}>
            Quick
          </button>
          <button type="button" role="radio" aria-checked={mode === 'detailed'} className={s.modeButton} onClick={() => switchMode('detailed')}>
            Detailed
          </button>
        </div>
        <span className={styles.muted}>
          {scoredCount} of {labels.length} saved
        </span>
      </div>
      <div className={s.progress} aria-hidden="true">
        <div className={s.progressFill} style={{ width: `${(scoredCount / Math.max(labels.length, 1)) * 100}%` }} />
      </div>
      <nav className={s.dots} aria-label="Jump to a sample">
        {labels.map((label) => (
          <a key={label} href={`#sample-${label}`} className={saved[label] ? `${s.dot} ${s.dotDone}` : s.dot} onClick={(e) => {
            e.preventDefault()
            document.getElementById(`sample-${label}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
          }}>
            {label}
            <span className={styles.srOnly}>{saved[label] ? ' (saved)' : ' (not scored yet)'}</span>
          </a>
        ))}
      </nav>
      {mode === 'quick' ? (
        <p className={styles.muted}>Just tell us how much you enjoy each one. There are no wrong answers.</p>
      ) : (
        <p className={styles.muted}>Score each part, then your overall enjoyment — that overall number is what counts in the rankings.</p>
      )}

      {labels.map((label) => {
        const sample = draft.samples[label]!
        const isSaved = Boolean(saved[label])
        const frozen = locked && isSaved
        const bottle = bottles?.[label]
        return (
          <section key={label} id={`sample-${label}`} className={isSaved ? `${s.sampleCard} ${s.sampleCardSaved}` : s.sampleCard} aria-labelledby={`sample-title-${label}`}>
            <div className={s.sampleHead}>
              <span className={styles.sampleBadge} aria-hidden="true">
                {label}
              </span>
              <div className={styles.grow}>
                <h3 id={`sample-title-${label}`} className={styles.sectionTitle}>
                  {bottle ? bottle.name : `Sample ${label}`}
                </h3>
                {bottle ? <div className={styles.muted}>{publicBottleSummary(bottle)}</div> : null}
                <span className={styles.muted}>{frozen ? 'Submitted — locked by your host' : isSaved ? 'Saved ✓' : 'Not scored yet'}</span>
              </div>
              {guidedBottles && bottle?.imageUrl ? <img className={s.guidedImage} src={bottle.imageUrl} alt="" /> : null}
            </div>
            {guidedBottles && bottle ? <LearnAboutThisPour bottle={bottle} categoryName={category.name} /> : null}

            {mode === 'detailed'
              ? DETAILED_FIELDS.map((field) => (
                  <ScoreInput
                    key={field.key}
                    id={`${field.key}-${label}`}
                    label={field.label}
                    hint={field.hint}
                    value={sample[field.key]}
                    disabled={frozen}
                    onChange={(v) => updateSample(label, { [field.key]: v })}
                  />
                ))
              : null}

            <ScoreInput
              id={`overall-${label}`}
              label="Overall enjoyment"
              value={sample.overall}
              describe={enjoymentWord}
              disabled={frozen}
              large
              onChange={(v) => updateSample(label, { overall: v })}
            />

            <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
              <span className={styles.label}>{mode === 'quick' ? 'What do you notice? (optional)' : 'Flavor descriptors'}</span>
              {descriptorsFor(mode).map((group) =>
                mode === 'quick' ? (
                  <div key={group.id} className={s.chips}>
                    {group.descriptors.map((d) => (
                      <TapChip
                        key={d}
                        label={d}
                        active={sample.descriptors.includes(d)}
                        onToggle={() =>
                          !frozen &&
                          updateSample(label, {
                            descriptors: sample.descriptors.includes(d) ? sample.descriptors.filter((x) => x !== d) : [...sample.descriptors, d].slice(0, 12),
                          })
                        }
                      />
                    ))}
                  </div>
                ) : (
                  <details key={group.id} className={s.family}>
                    <summary>
                      {group.label}
                      {sample.descriptors.some((d) => group.descriptors.includes(d))
                        ? ` · ${sample.descriptors.filter((d) => group.descriptors.includes(d)).length} picked`
                        : ''}
                    </summary>
                    <div className={s.chips}>
                      {group.descriptors.map((d) => (
                        <TapChip
                          key={d}
                          label={d}
                          active={sample.descriptors.includes(d)}
                          onToggle={() =>
                            !frozen &&
                            updateSample(label, {
                              descriptors: sample.descriptors.includes(d) ? sample.descriptors.filter((x) => x !== d) : [...sample.descriptors, d].slice(0, 12),
                            })
                          }
                        />
                      ))}
                    </div>
                  </details>
                ),
              )}
            </div>

            {mode === 'detailed' ? (
              <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
                <label className={styles.label} htmlFor={`notes-${label}`}>
                  Tasting notes (private to you)
                </label>
                <textarea
                  id={`notes-${label}`}
                  className={`${styles.input} ${s.notes}`}
                  maxLength={500}
                  value={sample.notes}
                  disabled={frozen}
                  onChange={(e) => updateSample(label, { notes: e.target.value })}
                />
              </div>
            ) : null}

            {!frozen ? (
              <Button
                variant={isSaved && !pending.includes(label) ? 'secondary' : 'primary'}
                disabled={sample.overall === null || saving !== null || (!pending.includes(label) && isSaved)}
                onClick={() => submit(label)}
              >
                {saving === label ? 'Saving…' : isSaved && !pending.includes(label) ? 'Saved' : isSaved ? `Update sample ${label}` : `Save sample ${label}`}
              </Button>
            ) : null}
          </section>
        )
      })}

      <section className={styles.card} aria-labelledby="favorite-heading">
        <h3 id="favorite-heading" className={styles.sectionTitle}>
          Your favorite
        </h3>
        <p className={styles.muted}>Which one would you pour again? This is your People’s Choice vote.</p>
        <div className={styles.row} role="radiogroup" aria-labelledby="favorite-heading">
          {labels.map((label) => (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={draft.favoriteLabel === label}
              className={styles.choice}
              style={{ width: 'auto', flex: '1 1 64px', justifyContent: 'center' }}
              disabled={locked && Boolean(ballot?.favoriteLabel)}
              onClick={() => setDraft((d) => ({ ...d, favoriteLabel: d.favoriteLabel === label ? null : label }))}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {party.settings?.predictions ? (
        <section className={styles.card} aria-labelledby="prediction-heading">
          <h3 id="prediction-heading" className={styles.sectionTitle}>
            Your prediction
          </h3>
          <p className={styles.muted}>Which sample do you think the whole room will rate highest?</p>
          <div className={styles.row} role="radiogroup" aria-labelledby="prediction-heading">
            {labels.map((label) => (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={draft.predictionLabel === label}
                className={styles.choice}
                style={{ width: 'auto', flex: '1 1 64px', justifyContent: 'center' }}
                disabled={locked && Boolean(ballot?.predictionLabel)}
                onClick={() => setDraft((d) => ({ ...d, predictionLabel: d.predictionLabel === label ? null : label }))}
              >
                {label}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      <p className={styles.srOnly} aria-live="polite">
        {announcement}
      </p>

      <div className={styles.stickyActions}>
        <div className={styles.stickyInner}>
          <Button disabled={saving !== null || (!pending.length && !favoriteDirty && !predictionDirty)} onClick={() => submit()}>
            {saving === 'all' ? 'Saving…' : pending.length || favoriteDirty || predictionDirty ? 'Save my scores' : 'All saved ✓'}
          </Button>
        </div>
      </div>
    </div>
  )
}
