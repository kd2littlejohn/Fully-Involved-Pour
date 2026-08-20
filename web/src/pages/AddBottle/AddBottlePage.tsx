import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { SignInButton } from '../../components/domain/SignInButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/LinkButton'
import type { BottleStatus } from '../../data/types'
import type { LabelScanResult } from '../../data/repositories/ai'
import { BottlePhotoHero, type BottlePhotoChange } from './BottlePhotoHero'
import { AddBottleEntryChoice } from './AddBottleEntryChoice'
import { EssentialFieldsCard, type EssentialFieldsValues } from './EssentialFieldsCard'
import { OwnershipFieldsCard, type OwnershipFieldsValues } from './OwnershipFieldsCard'
import styles from './AddBottlePage.module.css'

// 'choice' only ever applies to a fresh, from-scratch add (see the initial
// state below) — editing an existing bottle or arriving with a prefill
// (e.g. "Add to Wishlist" from Discover) always goes straight to 'form'.
type Mode = 'choice' | 'form'

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
  const { bottleId } = useParams<{ bottleId: string }>()
  const isEditing = Boolean(bottleId)
  const { user, loading: authLoading } = useAuth()
  const { userDoc, loading: dataLoading, addBottle, updateBottle } = useUserData()

  const existingBottle = isEditing ? userDoc.bottles.find((b) => b.id === bottleId) : undefined

  const state = location.state as LocationState | null
  const defaultStatus = state?.defaultStatus ?? 'sealed'

  const [photo, setPhoto] = useState<BottlePhotoChange>({ imageUrl: undefined })
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
    quantity: '',
    purchaseDate: '',
    openedDate: '',
    expectedDate: '',
    finishedDate: '',
    notes: '',
  })
  const [nameError, setNameError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [mode, setMode] = useState<Mode>(() => (isEditing || state?.prefill?.name ? 'form' : 'choice'))

  // Hydrates the form once the bottle being edited is available — handles
  // both the common case (data already loaded from a prior page) and a
  // fresh/direct load of the edit URL where userDoc arrives asynchronously.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!isEditing || hydratedRef.current || !existingBottle) return
    hydratedRef.current = true
    setPhoto({
      imageUrl: existingBottle.imageUrl,
      originalImageUrl: existingBottle.originalImageUrl,
      imageProcessingStatus: existingBottle.imageProcessingStatus,
    })
    setEssential({
      name: existingBottle.name,
      distillery: existingBottle.distillery ?? '',
      type: existingBottle.type ?? '',
      proof: existingBottle.proof != null ? String(existingBottle.proof) : '',
      ageStatement: existingBottle.ageStatement ?? '',
      region: existingBottle.region ?? '',
    })
    setOwnership({
      status: existingBottle.status,
      price: existingBottle.price != null ? String(existingBottle.price) : '',
      storeLocation: existingBottle.storeLocation ?? '',
      quantity: existingBottle.quantity != null ? String(existingBottle.quantity) : '',
      purchaseDate: existingBottle.purchaseDate ?? '',
      openedDate: existingBottle.openedDate ?? '',
      expectedDate: existingBottle.expectedDate ?? '',
      // Legacy finished bottles with no stored date load blank rather than
      // being backfilled with an inferred value — the user only ever gets a
      // real, deliberately-entered date here.
      finishedDate: existingBottle.finishedDate ?? '',
      notes: existingBottle.notes ?? '',
    })
  }, [isEditing, existingBottle])

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
      const payload = {
        name,
        distillery: essential.distillery.trim() || undefined,
        type: essential.type.trim() || undefined,
        region: essential.region.trim() || undefined,
        proof: essential.proof ? Number(essential.proof) : undefined,
        ageStatement: essential.ageStatement.trim() || undefined,
        imageUrl: photo.imageUrl,
        originalImageUrl: photo.originalImageUrl,
        imageProcessingStatus: photo.imageProcessingStatus,
        status: ownership.status,
        price: ownership.price ? Number(ownership.price) : undefined,
        storeLocation: ownership.storeLocation.trim() || undefined,
        quantity: ownership.quantity ? Number(ownership.quantity) : undefined,
        // Every date is saved as entered, independent of the current status —
        // a bottle's history (purchased/opened/expected/finished) stays
        // editable even after its status has since moved on.
        purchaseDate: ownership.purchaseDate.trim() || undefined,
        openedDate: ownership.openedDate.trim() || undefined,
        expectedDate: ownership.expectedDate.trim() || undefined,
        finishedDate: ownership.finishedDate.trim() || undefined,
        notes: ownership.notes.trim() || undefined,
      }
      if (isEditing && bottleId) {
        await updateBottle(bottleId, payload)
        navigate(`/collection/${bottleId}`)
      } else {
        const id = await addBottle(payload)
        navigate(id ? `/collection/${id}` : '/collection')
      }
    } catch (err) {
      // Form data is preserved — nothing is cleared on failure, so the user
      // can just retry without re-entering everything.
      setSubmitError(err instanceof Error ? err.message : 'The bottle could not be saved. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const pageTitle = isEditing ? 'Edit Bottle' : 'Add Bottle'

  if (authLoading || (isEditing && dataLoading)) {
    return <div className={styles.page} />
  }

  if (!user) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)} aria-label="Back">
            ←
          </button>
          <h1 className={styles.title}>{pageTitle}</h1>
          <span className={styles.headerSpacer} aria-hidden="true" />
        </div>
        <EmptyState
          title="Sign in to continue."
          message="Fully Involved Pour uses Google sign-in to sync your bar."
          action={<SignInButton />}
        />
      </div>
    )
  }

  if (isEditing && !existingBottle) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <button type="button" className={styles.backButton} onClick={() => navigate(-1)} aria-label="Back">
            ←
          </button>
          <h1 className={styles.title}>{pageTitle}</h1>
          <span className={styles.headerSpacer} aria-hidden="true" />
        </div>
        <EmptyState
          title="We couldn't find this bottle."
          message="It may have been removed from your bar."
          action={<LinkButton to="/collection">Back to My Bar</LinkButton>}
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
        <h1 className={styles.title}>{pageTitle}</h1>
        <button type="button" className={styles.cancelButton} onClick={() => navigate(-1)} disabled={submitting}>
          Cancel
        </button>
      </div>

      {mode === 'choice' ? (
        <div className={styles.content}>
          <AddBottleEntryChoice onScanLabel={() => setMode('form')} onManualEntry={() => setMode('form')} />
        </div>
      ) : null}

      {mode === 'form' ? (
        <>
          <div className={styles.content}>
            <BottlePhotoHero imageUrl={photo.imageUrl} name={essential.name} onImageChange={setPhoto} onScanResult={handleScanResult} />

            <div className={styles.cards}>
              <EssentialFieldsCard
                values={essential}
                onChange={(patch) => {
                  setEssential((prev) => ({ ...prev, ...patch }))
                  if (patch.name?.trim()) setNameError(null)
                }}
                nameError={nameError ?? undefined}
              />
              <OwnershipFieldsCard
                values={ownership}
                onChange={(patch) => setOwnership((prev) => ({ ...prev, ...patch }))}
                bottleContext={{ name: essential.name, distillery: essential.distillery, type: essential.type, proof: essential.proof }}
              />
            </div>
          </div>

          <div className={styles.actionBar}>
            {submitError ? (
              <p className={styles.submitError} role="alert">
                {submitError}
              </p>
            ) : null}
            <button type="button" className={styles.primaryButton} onClick={handleSubmit} disabled={submitting}>
              {submitting ? 'Saving…' : isEditing ? 'Save Changes' : 'Add Bottle'}
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
