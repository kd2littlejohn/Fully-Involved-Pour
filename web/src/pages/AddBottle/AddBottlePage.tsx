import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { SignInButton } from '../../components/domain/SignInButton'
import { EmptyState } from '../../components/ui/EmptyState'
import { LinkButton } from '../../components/ui/LinkButton'
import { Button } from '../../components/ui/Button'
import type { BottleStatus } from '../../data/types'
import type { LabelScanResult } from '../../data/repositories/ai'
import {
  findBottleByUpc,
  lookupBottleByBarcode,
  saveBottleToCatalog,
  BarcodeLookupTimeoutError,
  type BarcodeLookupResult,
} from '../../data/repositories/barcode'
import { BarcodeScannerModal } from '../../features/barcodeScan/BarcodeScannerModal'
import { BottlePhotoHero } from './BottlePhotoHero'
import { AddBottleEntryChoice } from './AddBottleEntryChoice'
import { BarcodeFoundReview } from './BarcodeFoundReview'
import { EssentialFieldsCard, type EssentialFieldsValues } from './EssentialFieldsCard'
import { OwnershipFieldsCard, type OwnershipFieldsValues } from './OwnershipFieldsCard'
import styles from './AddBottlePage.module.css'

// 'choice'/'scanning'/'looking-up'/'review-*' only ever apply to a fresh,
// from-scratch add (see the initial state below) — editing an existing
// bottle or arriving with a prefill (e.g. "Add to Wishlist" from Discover)
// always goes straight to 'form', unchanged from before this feature.
type Mode = 'choice' | 'scanning' | 'looking-up' | 'review-found' | 'review-not-found' | 'form'

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
  const [barcodeResult, setBarcodeResult] = useState<BarcodeLookupResult | undefined>(undefined)
  const [pendingUpc, setPendingUpc] = useState<string | undefined>(undefined)
  const [notFoundTitle, setNotFoundTitle] = useState("We couldn't find this bottle yet.")
  const [addingFromReview, setAddingFromReview] = useState(false)

  const alreadyOwnedBottle = barcodeResult ? userDoc.bottles.find((b) => b.upc === barcodeResult.upc) : undefined

  // Only the review screen's own "Add to My Bar" writes a bottle without
  // ever visiting the form — everything else (Edit Details, Scan Label,
  // Manual Entry, and finishing after an unknown-UPC scan) funnels back
  // into the one existing handleSubmit below, carrying pendingUpc with it.
  async function handleUpcDetected(upc: string) {
    setPendingUpc(upc)
    setMode('looking-up')
    try {
      if (!navigator.onLine) {
        setNotFoundTitle("You're offline.")
        setMode('review-not-found')
        return
      }
      const result = (await findBottleByUpc(upc)) ?? (await lookupBottleByBarcode(upc))
      if (result.found) {
        setBarcodeResult(result)
        setMode('review-found')
      } else {
        setNotFoundTitle("We couldn't find this bottle yet.")
        setMode('review-not-found')
      }
    } catch (err) {
      setNotFoundTitle(
        err instanceof BarcodeLookupTimeoutError ? 'That lookup took too long.' : "Something went wrong looking up that barcode.",
      )
      setMode('review-not-found')
    }
  }

  function contributeToCatalog(upc: string, bottle: { name: string; distillery?: string; type?: string; proof?: number; ageStatement?: string; imageUrl?: string }) {
    // Best-effort — a failed catalog contribution should never block or
    // fail the user's own save, so this is deliberately not awaited by
    // its callers.
    saveBottleToCatalog(upc, bottle).catch((err) => console.error('saveBottleToCatalog failed', err))
  }

  async function handleAddFromReview() {
    if (!barcodeResult || addingFromReview) return
    setAddingFromReview(true)
    setSubmitError(null)
    try {
      const name = barcodeResult.name?.trim() || 'Unknown Bottle'
      const payload = {
        name,
        distillery: barcodeResult.distillery?.trim() || undefined,
        type: barcodeResult.type || undefined,
        proof: barcodeResult.proof || undefined,
        ageStatement: barcodeResult.ageStatement || undefined,
        imageUrl: barcodeResult.imageUrl || undefined,
        status: defaultStatus,
        upc: barcodeResult.upc,
      }
      const id = await addBottle(payload)
      contributeToCatalog(barcodeResult.upc, {
        name,
        distillery: payload.distillery,
        type: payload.type,
        proof: payload.proof,
        ageStatement: payload.ageStatement,
        imageUrl: payload.imageUrl,
      })
      navigate(id ? `/collection/${id}` : '/collection')
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'The bottle could not be saved. Please try again.')
    } finally {
      setAddingFromReview(false)
    }
  }

  function handleEditFromReview() {
    if (!barcodeResult) return
    setEssential((prev) => ({
      name: barcodeResult.name?.trim() || prev.name,
      distillery: barcodeResult.distillery?.trim() || prev.distillery,
      type: barcodeResult.type || prev.type,
      region: prev.region,
      proof: prev.proof || (barcodeResult.proof ? String(barcodeResult.proof) : prev.proof),
      ageStatement: barcodeResult.ageStatement?.trim() || prev.ageStatement,
    }))
    if (barcodeResult.imageUrl) setImageUrl(barcodeResult.imageUrl)
    setMode('form')
  }

  // Hydrates the form once the bottle being edited is available — handles
  // both the common case (data already loaded from a prior page) and a
  // fresh/direct load of the edit URL where userDoc arrives asynchronously.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!isEditing || hydratedRef.current || !existingBottle) return
    hydratedRef.current = true
    setImageUrl(existingBottle.imageUrl)
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
        imageUrl,
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
        // Set whenever this bottle started life as a barcode scan — whether
        // it resolved via a catalog/external match the user then edited, or
        // was completed fully by hand after an unknown UPC. Never set for
        // editing an existing bottle (the choice screen — and so scanning —
        // never appears in that flow).
        upc: pendingUpc,
      }
      if (isEditing && bottleId) {
        await updateBottle(bottleId, payload)
        navigate(`/collection/${bottleId}`)
      } else {
        const id = await addBottle(payload)
        if (pendingUpc) {
          contributeToCatalog(pendingUpc, {
            name,
            distillery: payload.distillery,
            type: payload.type,
            proof: payload.proof,
            ageStatement: payload.ageStatement,
            imageUrl,
          })
        }
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

  const busy = submitting || addingFromReview || mode === 'looking-up'

  function handleBack() {
    // A scan that resolved (or failed to) is easy to back out of one level
    // at a time, back to the three original choices — only 'form' and
    // 'choice' itself fall through to actually leaving the page, matching
    // the original single-mode behavior exactly for editing/prefilled adds.
    if (mode === 'looking-up' || mode === 'review-found' || mode === 'review-not-found') {
      setMode('choice')
      return
    }
    navigate(-1)
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <button type="button" className={styles.backButton} onClick={handleBack} aria-label="Back" disabled={busy}>
          ←
        </button>
        <h1 className={styles.title}>{pageTitle}</h1>
        <button type="button" className={styles.cancelButton} onClick={() => navigate(-1)} disabled={busy}>
          Cancel
        </button>
      </div>

      {mode === 'choice' ? (
        <div className={styles.content}>
          <AddBottleEntryChoice
            onScanUpc={() => setMode('scanning')}
            onScanLabel={() => setMode('form')}
            onManualEntry={() => setMode('form')}
          />
        </div>
      ) : null}

      {mode === 'looking-up' ? (
        <div className={styles.content}>
          <p className={styles.loadingState}>Looking up that barcode…</p>
        </div>
      ) : null}

      {mode === 'review-found' && barcodeResult ? (
        <>
          <div className={styles.content}>
            <BarcodeFoundReview result={barcodeResult} alreadyOwnedName={alreadyOwnedBottle?.name} />
          </div>
          <div className={styles.actionBar}>
            {submitError ? (
              <p className={styles.submitError} role="alert">
                {submitError}
              </p>
            ) : null}
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => void handleAddFromReview()}
              disabled={addingFromReview}
            >
              {addingFromReview ? 'Adding…' : 'Add to My Bar'}
            </button>
            <div className={styles.reviewSecondaryRow}>
              <Button variant="secondary" onClick={handleEditFromReview} disabled={addingFromReview}>
                Edit Details
              </Button>
              <Button variant="ghost" onClick={() => setMode('scanning')} disabled={addingFromReview}>
                Scan Again
              </Button>
            </div>
          </div>
        </>
      ) : null}

      {mode === 'review-not-found' ? (
        <div className={styles.content}>
          <EmptyState
            title={notFoundTitle}
            message="Try scanning the label instead, or type in the details yourself."
            action={
              <div className={styles.notFoundActions}>
                <Button onClick={() => setMode('form')}>Scan Label with AI</Button>
                <Button variant="secondary" onClick={() => setMode('form')}>
                  Enter Bottle Manually
                </Button>
              </div>
            }
          />
        </div>
      ) : null}

      {mode === 'form' ? (
        <>
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

      {mode === 'scanning' ? (
        <BarcodeScannerModal
          onDetected={(upc) => void handleUpcDetected(upc)}
          onManualEntry={() => setMode('form')}
          onClose={() => setMode('choice')}
        />
      ) : null}
    </div>
  )
}
