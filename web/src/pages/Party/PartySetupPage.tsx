import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { ProgressStepper } from '../../components/ui/ProgressStepper'
import { SignInButton } from '../../components/domain/SignInButton'
import { PhotoUploadField } from '../../features/photoUpload/PhotoUploadField'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { PartyLoading, PartyMessage, PartyPage, ToggleRow } from '../../features/party/PartyChrome'
import { CategoriesStep } from '../../features/party/setup/CategoriesStep'
import { BottlesStep } from '../../features/party/setup/BottlesStep'
import { LabelsStep } from '../../features/party/setup/LabelsStep'
import {
  draftEventDate,
  draftFromParty,
  draftProblems,
  emptyDraft,
  finalizeLabels,
  mergeBottleKey,
  bottleKeyHidden,
  type DraftCategory,
  type PartyDraft,
} from '../../features/party/setupDraft'
import { useMyAdminRole, useParty } from '../../features/party/usePartyData'
import { ConfirmDialog } from '../../features/party/ConfirmDialog'
import {
  createParty,
  deleteCustomCategory,
  getBottleKey,
  deletePartyTemplate,
  getPartyTemplates,
  getSavedCategories,
  partyErrorMessage,
  saveCustomCategory,
  savePartyTemplate,
  setHostTasting,
  setPartyCategories,
  setPartySamples,
  updateParty,
} from '../../data/repositories/party'
import type { PartySettings, PartyTemplate, SavedTastingCategory } from '../../features/party/types'
import { partyFormat } from '../../features/party/types'
import styles from '../../features/party/party.module.css'
import local from '../../features/party/setup/setup.module.css'

const STEPS = ['Details', 'Categories', 'Bottles', 'Sample letters', 'Scoring']

// Create a Party (/party/new) and Edit Setup (/party/:partyId/setup) — one
// guided flow. Everything is a local draft until the host saves; then the
// server creates/updates the party, its rounds, and each round's
// host-only bottle mapping.
export function PartySetupPage() {
  const { partyId } = useParams<{ partyId: string }>()
  const isEdit = Boolean(partyId)
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { userDoc, profile } = useUserData()
  const party = useParty(partyId, isEdit && Boolean(user))
  const adminRole = useMyAdminRole(isEdit ? partyId : undefined, user?.uid)

  const [searchParams] = useSearchParams()
  const [draft, setDraft] = useState<PartyDraft>(() => ({ ...emptyDraft(), format: searchParams.get('format') === 'regular' ? 'regular' : 'blind' }))
  const [loadedFrom, setLoadedFrom] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<SavedTastingCategory[]>([])
  const [templates, setTemplates] = useState<PartyTemplate[]>([])
  const [confirmKey, setConfirmKey] = useState(false)
  const [loadingKey, setLoadingKey] = useState(false)

  // Editing never pulls the bottle key on its own: rounds keep their saved
  // bottles hidden until an admin opens the key for the Bottles or Letters
  // step (confirmed and logged by the server). Regular tastings have
  // nothing secret, so their bottles load straight away.
  useEffect(() => {
    if (!isEdit || loadedFrom || !party.data) return
    const loaded = party.data
    setDraft(draftFromParty(loaded))
    setLoadedFrom(loaded.id)
    if (partyFormat(loaded) === 'regular' && loaded.categories.some((c) => c.sampleLabels.length)) {
      getBottleKey(loaded.id, 'setup')
        .then((key) => setDraft((d) => mergeBottleKey(d, key)))
        .catch((err) => setError(partyErrorMessage(err)))
    }
  }, [isEdit, loadedFrom, party.data])

  async function openBottleKey() {
    if (!partyId) return
    setLoadingKey(true)
    setError(null)
    try {
      const key = await getBottleKey(partyId, 'setup')
      setDraft((d) => mergeBottleKey(d, key))
      setConfirmKey(false)
    } catch (err) {
      setError(partyErrorMessage(err))
    } finally {
      setLoadingKey(false)
    }
  }

  useEffect(() => {
    if (!user) return
    getSavedCategories(user.uid).then(setSaved).catch((err) => console.error('[party] saved categories', err))
    getPartyTemplates(user.uid).then(setTemplates).catch((err) => console.error('[party] templates', err))
  }, [user])

  const setCategories = useCallback((categories: DraftCategory[]) => setDraft((d) => ({ ...d, categories })), [])
  const setSettings = (patch: Partial<PartySettings>) => setDraft((d) => ({ ...d, settings: { ...d.settings, ...patch } }))

  if (authLoading || (isEdit && user && (adminRole.loading || ((party.loading || !loadedFrom) && !party.error)))) return <PartyLoading />
  if (!user) {
    return (
      <PartyMessage
        title="Host a party"
        message="Sign in to your FIP account to create and run a party. Your guests won’t need an account."
        action={<SignInButton />}
      />
    )
  }
  if (isEdit && (party.error || !party.data)) {
    return <PartyMessage title="Party not found" message="This party doesn’t exist or you aren’t its host." />
  }
  // From this account's own protected admin record.
  const isHost = !isEdit || adminRole.role === 'host'
  if (isEdit && party.data && adminRole.role === null) {
    return <PartyMessage title="Hosts only" message="Only this party’s host and co-hosts can edit its setup." />
  }
  if (isEdit && party.data?.status === 'completed') {
    return <PartyMessage title="Party wrapped up" message="This party is complete, so its setup can no longer change." />
  }

  const formatLocked = draft.categories.some((c) => c.locked)
  const keyHidden = bottleKeyHidden(draft)
  // A tasting host choosing bottles themselves knows them (blind only).
  const hostWillKnow = isHost && draft.hostTasting && draft.format === 'blind' && draft.categories.some((c) => !c.locked)
  const problems = draftProblems(draft)
  const stepProblems = [problems.details, problems.categories, problems.bottles, [], []]

  function goTo(next: number) {
    setError(null)
    if (next === 3) {
      // Settle letters as the host is about to see them, so what they see
      // is exactly what gets saved.
      setDraft((d) => ({
        ...d,
        categories: finalizeLabels(d.categories).map((c) => (c.samples.length ? { ...c, manualLabels: true } : c)),
      }))
    }
    setStep(next)
    window.scrollTo({ top: 0 })
  }

  async function save() {
    const all = [...problems.details, ...problems.categories, ...problems.bottles]
    if (all.length) {
      setError(all[0]!)
      return
    }
    setSaving(true)
    setError(null)
    const categories = finalizeLabels(draft.categories)
    const details = {
      name: draft.name.trim(),
      description: draft.description.trim(),
      eventDate: draftEventDate(draft),
      coverImageUrl: draft.coverImageUrl,
      capacity: draft.capacity ? Number(draft.capacity) : null,
    }
    try {
      let id = partyId
      let serverIds: string[]
      if (!id) {
        const created = await createParty({
          details,
          settings: draft.settings,
          categories: categories.map((c) => ({ libraryId: c.libraryId, name: c.name.trim(), description: c.description.trim() })),
          hostName: profile?.displayName || user!.displayName || 'Your host',
          hostTasting: draft.hostTasting,
          format: draft.format,
        })
        id = created.partyId
        serverIds = created.categories.map((c) => c.id)
      } else {
        await updateParty(id, {
          details,
          settings: draft.settings,
          ...(draft.format !== (party.data ? partyFormat(party.data) : 'blind') ? { format: draft.format } : {}),
        })
        if (isHost && draft.hostTasting !== (party.data?.hostTasting === true)) await setHostTasting(id, draft.hostTasting)
        const result = await setPartyCategories(
          id,
          categories.map((c) => ({ ...(c.id ? { id: c.id } : {}), libraryId: c.libraryId, name: c.name.trim(), description: c.description.trim() })),
        )
        serverIds = result.categories.map((c) => c.id)
      }
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i]!
        const categoryId = serverIds[i]
        if (!categoryId || category.locked || (!category.samplesDirty && category.id)) continue
        if (category.samples.length === 0 && !category.id) continue
        await setPartySamples(
          id,
          categoryId,
          category.samples.map((s) => ({ bottle: s.bottle, label: s.label })),
          'manual',
        )
      }
      navigate(`/party/${id}/host`, { replace: true })
    } catch (err) {
      console.error('[party] save failed', err)
      setError(partyErrorMessage(err))
      setSaving(false)
    }
  }

  const myBar = userDoc.bottles.filter((b) => b.status !== 'wishlist')

  return (
    <PartyPage back={{ to: isEdit ? `/party/${partyId}/host` : '/blind/party', label: isEdit ? 'Dashboard' : 'Party Mode' }}>
      <div className={styles.stack}>
        <span className={styles.eyebrow}>{isEdit ? 'Edit setup' : 'Create a party'}</span>
        <h1 className={styles.title}>{draft.name.trim() || 'Your whiskey party'}</h1>
      </div>
      <div className={local.stepNav}>
        <ProgressStepper labels={STEPS} activeIndex={step} />
      </div>

      {step === 0 ? (
        <section className={styles.card} aria-labelledby="details-heading">
          <h2 id="details-heading" className={styles.sectionTitle}>
            Event details
          </h2>
          <fieldset className={styles.fieldset}>
            <legend className={styles.label}>Kind of tasting</legend>
            <div className={styles.row}>
              {(['blind', 'regular'] as const).map((format) => (
                <label key={format} className={styles.choice} style={{ flex: '1 1 200px', width: 'auto' }}>
                  <input
                    type="radio"
                    name="party-format"
                    value={format}
                    checked={draft.format === format}
                    disabled={formatLocked}
                    onChange={() => setDraft((d) => ({ ...d, format }))}
                  />
                  <span style={{ fontWeight: 700 }}>
                    {format === 'blind' ? 'Blind tasting' : 'Regular tasting'}
                    <span className={styles.muted} style={{ display: 'block', fontWeight: 400 }}>
                      {format === 'blind'
                        ? 'Samples are A, B, C… Bottles stay hidden until you reveal them.'
                        : 'Everyone sees each bottle while they score. Results show when voting closes.'}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {formatLocked ? <p className={styles.muted}>A round has opened for voting, so the kind of tasting is set.</p> : null}
          <label className={styles.label} htmlFor="party-name">
            Event name *
          </label>
          <input
            id="party-name"
            className={styles.input}
            value={draft.name}
            maxLength={80}
            placeholder="Friday Night Blind"
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          />
          <div className={local.formGrid}>
            <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
              <label className={styles.label} htmlFor="party-date">
                Date (optional)
              </label>
              <input id="party-date" type="date" className={styles.input} value={draft.eventDate} onChange={(e) => setDraft({ ...draft, eventDate: e.target.value })} />
            </div>
            <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
              <label className={styles.label} htmlFor="party-time">
                Time (optional)
              </label>
              <input id="party-time" type="time" className={styles.input} value={draft.eventTime} onChange={(e) => setDraft({ ...draft, eventTime: e.target.value })} />
            </div>
            <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
              <label className={styles.label} htmlFor="party-capacity">
                Guest capacity (optional)
              </label>
              <input
                id="party-capacity"
                className={styles.input}
                inputMode="numeric"
                value={draft.capacity}
                placeholder="No limit"
                onChange={(e) => setDraft({ ...draft, capacity: e.target.value.replace(/\D/g, '') })}
              />
            </div>
          </div>
          <label className={styles.label} htmlFor="party-description">
            Description (optional)
          </label>
          <textarea
            id="party-description"
            className={styles.input}
            rows={3}
            maxLength={400}
            value={draft.description}
            placeholder="Bring a friend. We’ll pour, you score."
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
          />
          {draft.coverImageUrl ? <img className={local.cover} src={draft.coverImageUrl} alt="" /> : null}
          <PhotoUploadField
            label="Cover image (optional)"
            folder="party-covers"
            currentUrl={draft.coverImageUrl || undefined}
            onUploaded={(url) => setDraft((d) => ({ ...d, coverImageUrl: url.startsWith('https://') ? url : '' }))}
          />
        </section>
      ) : null}

      {step === 1 ? (
        <CategoriesStep
          categories={draft.categories}
          onChange={setCategories}
          saved={saved}
          templates={templates}
          onSaveCustom={async (input) => {
            try {
              const record = await saveCustomCategory(user.uid, input)
              setSaved((prev) => [...prev.filter((s) => s.id !== record.id), record].sort((a, b) => a.name.localeCompare(b.name)))
              return record
            } catch (err) {
              console.error('[party] save custom category', err)
              setError('Couldn’t save that category to your library.')
              return undefined
            }
          }}
          onDeleteCustom={async (id) => {
            await deleteCustomCategory(user.uid, id)
            setSaved((prev) => prev.filter((s) => s.id !== id))
          }}
          onSaveTemplate={async (name) => {
            const template = await savePartyTemplate(
              user.uid,
              name,
              draft.categories.map((c) => ({ libraryId: c.libraryId, name: c.name.trim(), description: c.description.trim() })),
            )
            setTemplates((prev) => [template, ...prev])
          }}
          onDeleteTemplate={async (id) => {
            await deletePartyTemplate(user.uid, id)
            setTemplates((prev) => prev.filter((t) => t.id !== id))
          }}
        />
      ) : null}

      {(step === 2 || step === 3) && keyHidden ? (
        <section className={styles.card} aria-labelledby="key-gate-heading">
          <h2 id="key-gate-heading" className={styles.sectionTitle}>
            Bottles are hidden
          </h2>
          <p className={styles.muted}>
            This party’s bottles stay out of sight until you open the bottle key, so you can edit everything else without seeing them.
          </p>
          <Button onClick={() => setConfirmKey(true)} disabled={loadingKey}>
            {loadingKey ? 'Opening…' : 'Show bottle key to edit'}
          </Button>
        </section>
      ) : null}
      {step === 2 && !keyHidden ? (
        <>
          {hostWillKnow ? (
            <p className={styles.notice} role="note">
              You’re tasting too, so choosing these bottles marks your own scores in these rounds as <strong>not fully blind</strong>. They still count. To taste
              blind, leave the bottles empty and invite a co-host from your dashboard to add them.
            </p>
          ) : null}
          <BottlesStep categories={draft.categories} onChange={setCategories} myBar={myBar} />
        </>
      ) : null}
      {step === 3 && !keyHidden ? <LabelsStep categories={draft.categories} onChange={setCategories} /> : null}
      {confirmKey ? (
        <ConfirmDialog
          title="Show the bottle key?"
          message={
            isHost && draft.hostTasting
              ? 'You’re tasting too. Seeing the bottles marks your scores as not fully blind in every unrevealed round you haven’t finished scoring. They still count equally. This view is logged.'
              : 'This shows every round’s bottles and letters. Views before the reveal are logged for the host and co-hosts to see.'
          }
          confirmLabel="Show bottle key"
          busy={loadingKey}
          onCancel={() => setConfirmKey(false)}
          onConfirm={() => void openBottleKey()}
        />
      ) : null}

      {step === 4 ? (
        <section className={styles.card} aria-labelledby="settings-heading">
          <h2 id="settings-heading" className={styles.sectionTitle}>
            Scoring and reveal
          </h2>
          {isHost ? (
            <ToggleRow
              id="host-tasting"
              label="I’m tasting too"
              hint="Score each round alongside your guests from My Tasting on your dashboard. Your scores count exactly like everyone else’s."
              checked={draft.hostTasting}
              onChange={(v) => setDraft((d) => ({ ...d, hostTasting: v }))}
            />
          ) : null}
          {isHost && draft.hostTasting && draft.format === 'blind' ? (
            <p className={styles.muted}>
              If you pick, label or pour the bottles yourself, your own scores are marked not fully blind (they still count). A co-host can set up the bottles so
              you taste blind.
            </p>
          ) : null}
          <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
            <span className={styles.label} id="scoring-mode-label">
              Default scoring for guests
            </span>
            <div className={styles.row} role="radiogroup" aria-labelledby="scoring-mode-label">
              {(['quick', 'detailed'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={draft.settings.defaultScoring === mode}
                  className={styles.choice}
                  style={{ flex: '1 1 200px', width: 'auto' }}
                  onClick={() => setSettings({ defaultScoring: mode })}
                >
                  <div>
                    <strong>{mode === 'quick' ? 'Quick Score' : 'Detailed Score'}</strong>
                    <div className={styles.muted}>
                      {mode === 'quick' ? 'One enjoyment rating per sample. Great for beginners.' : 'Nose, palate, finish and complexity.'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <span className={styles.muted}>Guests can switch modes anytime. Rankings always use overall enjoyment, so both count equally.</span>
          </div>
          <ToggleRow
            id="allow-edits"
            label="Let guests edit submitted scores"
            hint="While voting is open for that round."
            checked={draft.settings.allowEdits}
            onChange={(v) => setSettings({ allowEdits: v })}
          />
          <ToggleRow
            id="reveal-by-category"
            label="Reveal round by round"
            hint="Off: reveal every round together at the end."
            checked={draft.settings.revealByCategory}
            onChange={(v) => setSettings({ revealByCategory: v })}
          />
          <ToggleRow
            id="show-nicknames"
            label="Show guest nicknames on shared results"
            hint="Off: guests appear as Taster 1, Taster 2…"
            checked={draft.settings.showNicknames}
            onChange={(v) => setSettings({ showNicknames: v })}
          />
          <ToggleRow
            id="predictions"
            label="Ask for a winner prediction"
            hint="Guests guess the room’s favorite before reveal. Powers the Biggest Surprise award."
            checked={draft.settings.predictions}
            onChange={(v) => setSettings({ predictions: v })}
          />
          <p className={styles.muted}>You open, close and reveal each round yourself from the host dashboard. Nothing reveals automatically.</p>
        </section>
      ) : null}

      {stepProblems[step]!.length ? (
        <ul className={styles.list} aria-label="Before you continue">
          {stepProblems[step]!.map((p) => (
            <li key={p} className={styles.muted}>
              • {p}
            </li>
          ))}
        </ul>
      ) : null}
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <div className={styles.stickyActions}>
        <div className={styles.stickyInner}>
          {step > 0 ? (
            <Button variant="secondary" onClick={() => goTo(step - 1)} disabled={saving}>
              Back
            </Button>
          ) : null}
          {step < STEPS.length - 1 ? (
            <Button onClick={() => goTo(step + 1)} disabled={saving || (step === 0 && problems.details.length > 0)}>
              Continue
            </Button>
          ) : null}
          {step === STEPS.length - 1 || isEdit ? (
            <Button onClick={save} disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create party'}
            </Button>
          ) : null}
        </div>
      </div>
    </PartyPage>
  )
}
