import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { InfinityBottleHeader } from '../../features/infinityBottle/InfinityBottleHeader'
import { TastingForm, blankTastingValue, tastingValueToInput, type TastingFormValue } from '../../features/infinityBottle/TastingForm'
import { EmptyState } from '../../components/ui/EmptyState'
import { useUserData } from '../../hooks/useUserData'
import styles from './LogTastingPage.module.css'

export function LogTastingPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { userDoc, addTasting } = useUserData()
  const [value, setValue] = useState<TastingFormValue>(blankTastingValue())
  const [saving, setSaving] = useState(false)

  const ib = userDoc.infinityBottles.find((b) => b.id === id)
  const batch = ib?.batches[ib.batches.length - 1]

  if (!ib || !batch) {
    return (
      <div className={styles.page}>
        <InfinityBottleHeader backTo="/collection/infinity" title="Log a Tasting" />
        <div className={styles.body}>
          <EmptyState title="We couldn't find that Infinity Bottle." message="It may have been deleted." />
        </div>
      </div>
    )
  }

  async function handleSubmit() {
    if (saving) return
    setSaving(true)
    try {
      await addTasting(ib!.id, batch!.id, tastingValueToInput(value))
      navigate(`/collection/infinity/${ib!.id}/tastings`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <InfinityBottleHeader backTo={`/collection/infinity/${ib.id}/tastings`} title="Log a Tasting" />
      <div className={styles.body}>
        <TastingForm
          value={value}
          onChange={(patch) => setValue((prev) => ({ ...prev, ...patch }))}
          onSubmit={() => void handleSubmit()}
          submitLabel="Save Tasting"
          submitting={saving}
        />
      </div>
    </div>
  )
}
