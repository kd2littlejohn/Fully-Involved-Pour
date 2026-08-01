import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { SignInButton } from '../../components/domain/SignInButton'
import { EmptyState } from '../../components/ui/EmptyState'
import type { BottleStatus } from '../../data/types'
import type { LabelScanResult } from '../../data/repositories/ai'
import { BottlePhotoHero } from './BottlePhotoHero'
import { EssentialFieldsCard, type EssentialFieldsValues } from './EssentialFieldsCard'
import { OwnershipFieldsCard, type OwnershipFieldsValues } from './OwnershipFieldsCard'
import styles from './AddBottlePage.module.css'

interface LocationState {
  defaultStatus?: BottleStatus
  prefill?: {
    name?: string
    distillery?: string
    type?: string
  }
}

export function AddBottlePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { addBottle } = useUserData()

  const state = location.state as LocationState | null
  const defaultStatus = state?.defaultStatus ?? 'sealed'

  const [imageUrl, setImageUrl] = useState<string | undefined>(undefined)
  const [essential, setEssential] = useState<EssentialFieldsValues>({
    name: state?.prefill?.name ?? '',
    distillery: state?.prefill?.distillery ?? '',
    type: state?.prefill?.type ?? '',
    proof: '',
    ageStatement: '',
    region: '',
  })
  const [ownership, setOwnership] = useState<OwnershipFieldsValues>({
    status: defaultStatus,
    price: '',
    storeLocation: '',
    openedDate: '',
    expectedDate: '',
    notes: '',
  })
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function handleScanResult(info: LabelScanResult) {
    setEssential((prev) => ({
      name: prev.name.trim() || info.name || prev.name,
      distillery: prev.distillery.trim() || info.distillery || prev.distillery,
      type: info.type || prev.type,
      region: prev.region.trim() || info.region || prev.region,
      proof: prev.proof || (info.proof ? String(info.proof) : prev.proof),
      ageStatement: prev.ageStatement.trim() || info.ageStatement || prev.ageStatement,
    }))
  }

  async function handleSubmit() {
    if (submitting) return
    const name = essential.name.trim()
    if (!name) {
      setNameError('Bottle name is required.')
      return
    }
    setNameError(null)
    setSubmitError(null)
    setSubmitting(true)
    try {
      const id = await addBottle({
        name,
        distillery: essential.distillery.trim() || undefined,
        type: essential.type.trim() || undefined,
        region: essential.region.trim() || undefined,
        proof: essential.proof ? Number(essential.proof) : undefined,
        ageStatement: essential.ageStatement.trim() || undefined,
        imageUrl,
        status: ownership.status,
        price: ownership.price ? Number(ownership.price) : undefined,
        storeLocation: ownership.storeLocation.trim() || undefined,
        openedDate: ownership.status === 'open' ? ownership.openedDate.trim() || undefined : undefined,
        expectedDate: ownership.status === 'incoming' ? ownership.expectedDate.trim() || undefined : undefined,
        notes: ownership.notes.trim() || undefined,
      })
      navigate(id ? `/collection/${id}` : '/collection')
    } catch (err) {
      // Form data is preserved — nothing is cleared on failure, so the user
      // can just retry without re-entering everything.
      setSubmitError(err instanceof Error ? err.message : 'The bottle could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return <div className={styles.page} />
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)} aria-label="Back">
            ←
          </button>
          <h1 className={styles.title}>Add Bottle</h1>
          <span className={styles.headerSpacer} aria-hidden="true" />
        </div>
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your collection."
          action={<SignInButton />}
        />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={() => navigate(-1)} aria-label="Back" disabled={submitting}>
          ←
        </button>
        <h1 className={styles.title}>Add Bottle</h1>
        <button type="button" className={styles.cancelButton} onClick={() => navigate(-1)} disabled={submitting}>
          Cancel
        </button>
      </div>

      <div className={styles.content}>
        <BottlePhotoHero imageUrl={imageUrl} name={essential.name} onImageChange={setImageUrl} onScanResult={handleScanResult} />

        <div className={styles.cards}>
          <EssentialFieldsCard
            values={essential}
            onChange={(patch) => {
              setEssential((prev) => ({ ...prev, ...patch }))
              if (patch.name?.trim()) setNameError(null)
            }}
            nameError={nameError ?? undefined}
          />
          <OwnershipFieldsCard values={ownership} onChange={(patch) => setOwnership((prev) => ({ ...prev, ...patch }))} />
        </div>
      </div>

      <div className={styles.actionBar}>
        {submitError ? (
          <p className={styles.submitError} role="alert">
            {submitError}
          </p>
        ) : null}
        <button type="button" className={styles.primaryButton} onClick={handleSubmit} disabled={submitting}>
          {submitting ? 'Adding…' : 'Add Bottle'}
        </button>
      </div>
    </div>
  )
}
