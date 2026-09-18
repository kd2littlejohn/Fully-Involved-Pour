import { useEffect, useRef, useState } from 'react'
import { Button } from '../../components/ui/Button'
import { TapChip } from '../../components/ui/TapChip'
import { RaritySuggestionPanel, type RaritySuggestionPanelState } from '../../features/rarity/RaritySuggestionPanel'
import { RARITY_OPTIONS } from '../../features/rarity/rarityLevels'
import { manualRarityFields, acceptedRarityFields } from '../../features/rarity/rarityFields'
import {
  requestRaritySuggestion,
  rarityIdentity,
  rarityIdentityKey,
  hasSufficientRarityIdentity,
  RARITY_CLASSIFIER_VERSION,
} from '../../data/repositories/rarity'
import type { BottleRarity, BottleRaritySource, RarityConfidence, RaritySuggestion } from '../../data/types'
import fieldsStyles from './FieldsCard.module.css'
import styles from './RarityFieldsCard.module.css'

export interface RarityFieldsValues {
  rarity: BottleRarity | ''
  raritySource?: BottleRaritySource
  rarityConfidence?: RarityConfidence
  rarityReason?: string
  rarityConfirmedAt?: number
  raritySuggestion?: RaritySuggestion
}

export function blankRarityFieldsValues(): RarityFieldsValues {
  return { rarity: '' }
}

interface RarityFieldsCardProps {
  values: RarityFieldsValues
  onChange: (patch: Partial<RarityFieldsValues>) => void
  bottleContext: { name: string; distillery: string; type: string; region: string; ageStatement: string; proof: string }
}

// How long to let typing settle before auto-requesting a suggestion — same
// idiom (and roughly the same delay) as EssentialFieldsCard's own auto
// bottle-info lookup.
const RARITY_SUGGEST_DEBOUNCE_MS = 900

export function RarityFieldsCard({ values, onChange, bottleContext }: RarityFieldsCardProps) {
  const identity = rarityIdentity({
    name: bottleContext.name,
    distillery: bottleContext.distillery,
    type: bottleContext.type,
    region: bottleContext.region,
    ageStatement: bottleContext.ageStatement,
    proof: bottleContext.proof ? Number(bottleContext.proof) : undefined,
  })
  const sufficientIdentity = hasSufficientRarityIdentity(identity)
  const identityKey = rarityIdentityKey(identity)
  const validSuggestion =
    values.raritySuggestion && values.raritySuggestion.identityKey === identityKey && values.raritySuggestion.classifierVersion === RARITY_CLASSIFIER_VERSION
      ? values.raritySuggestion
      : undefined

  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'failed' | 'unavailable'>('idle')
  const [showChips, setShowChips] = useState(false)
  // The exact identity key we've already auto-requested for, so re-renders
  // (or reopening the form unchanged) never refire the same request — only
  // a genuinely new identity, or the explicit button, does.
  const autoRequestedForRef = useRef<string | null>(null)

  async function runSuggest() {
    autoRequestedForRef.current = identityKey
    setLoadState('loading')
    const outcome = await requestRaritySuggestion(identity, values.raritySuggestion)
    if (outcome.status === 'ready') {
      onChange({ raritySuggestion: outcome.suggestion })
      setLoadState('idle')
    } else {
      setLoadState(outcome.status)
    }
  }

  // Never fires while a rarity is already set (manual or confirmed) — a
  // manual pick is never auto-overwritten, and this form never
  // auto-refetches over a value the owner already confirmed. Skips when
  // there's insufficient identity, or when a still-valid suggestion (or an
  // already-in-flight request for this exact identity) already covers it.
  useEffect(() => {
    if (values.rarity) return
    if (!sufficientIdentity) return
    if (validSuggestion) return
    if (autoRequestedForRef.current === identityKey) return
    const timer = setTimeout(() => {
      void runSuggest()
    }, RARITY_SUGGEST_DEBOUNCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-fires only when identity or the confirmed rarity actually changes
  }, [identityKey, sufficientIdentity, Boolean(validSuggestion), values.rarity])

  function handleManualSuggest() {
    autoRequestedForRef.current = null
    void runSuggest()
  }

  function handleSelectRarity(rarity: BottleRarity) {
    onChange(manualRarityFields(rarity))
    setShowChips(false)
  }

  function handleAccept() {
    if (!validSuggestion) return
    const fields = acceptedRarityFields(validSuggestion)
    if (fields) onChange(fields)
  }

  const panelState: RaritySuggestionPanelState = loadState === 'loading' ? 'loading' : loadState === 'failed' ? 'failed' : loadState === 'unavailable' ? 'unavailable' : validSuggestion ? 'ready' : 'idle'

  return (
    <div className={fieldsStyles.card}>
      <h2 className={fieldsStyles.cardTitle}>Rarity</h2>

      {values.rarity && !showChips ? (
        <div className={styles.confirmedRow}>
          <TapChip label={RARITY_OPTIONS.find((o) => o.value === values.rarity)?.label ?? values.rarity} active onToggle={() => setShowChips(true)} />
          <span className={styles.confirmedHint}>{values.raritySource === 'manual' ? 'Set manually' : 'Confirmed from a suggestion'} — tap to change</span>
        </div>
      ) : (
        <div className={styles.chipRow}>
          {RARITY_OPTIONS.map((option) => (
            <TapChip key={option.value} label={option.label} active={values.rarity === option.value} onToggle={() => handleSelectRarity(option.value)} />
          ))}
        </div>
      )}

      <RaritySuggestionPanel state={panelState} suggestion={validSuggestion} onAccept={handleAccept} onChoose={() => setShowChips(true)} onRefresh={handleManualSuggest} />

      <Button variant="ghost" onClick={handleManualSuggest} disabled={loadState === 'loading' || !sufficientIdentity} className={styles.suggestButton}>
        {loadState === 'loading' ? 'Asking AI…' : validSuggestion || values.rarity ? 'Refresh Suggestion' : 'Suggest Rarity'}
      </Button>
    </div>
  )
}
