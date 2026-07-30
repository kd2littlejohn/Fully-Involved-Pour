import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { AddBottleForm, type AddBottleFormInput } from '../../components/domain/AddBottleForm'
import { downscaleImageToJpegBase64 } from '../ai/imageToBase64'
import { scanBottleLabel } from '../../data/repositories/ai'
import { useUserData } from '../../hooks/useUserData'
import styles from './QuickAddFromPhotoButton.module.css'

export function QuickAddFromPhotoButton() {
  const { addBottle } = useUserData()
  const [scanning, setScanning] = useState(false)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Partial<AddBottleFormInput>>({})
  const [showForm, setShowForm] = useState(false)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setScanning(true)
    setScanNotice(null)
    try {
      const base64 = await downscaleImageToJpegBase64(file)
      const info = await scanBottleLabel(base64, 'image/jpeg')
      if (!info.found) {
        setScanNotice("Couldn't read a bottle label in that photo — fill in the details manually below.")
        setPrefill({})
      } else {
        setPrefill({
          name: info.name,
          distillery: info.distillery,
          type: info.type,
          region: info.region,
          proof: info.proof,
          ageStatement: info.ageStatement,
          msrp: info.msrp,
        })
      }
    } catch {
      setScanNotice('Could not read that photo — fill in the details manually below.')
      setPrefill({})
    } finally {
      setScanning(false)
      setShowForm(true)
    }
  }

  return (
    <>
      <label className={styles.button}>
        {scanning ? 'Reading label…' : '📷 Add Bottle from Photo'}
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className={styles.hiddenInput}
          onChange={handleFile}
          disabled={scanning}
        />
      </label>

      {showForm ? (
        <Modal title="Add a Bottle" onClose={() => setShowForm(false)}>
          {scanNotice ? <p className={styles.notice}>{scanNotice}</p> : null}
          <AddBottleForm
            initialValues={prefill}
            onCancel={() => setShowForm(false)}
            onSubmit={async (input) => {
              await addBottle(input)
              setShowForm(false)
            }}
          />
        </Modal>
      ) : null}
    </>
  )
}
