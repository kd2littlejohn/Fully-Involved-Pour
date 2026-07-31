import { useState, type ChangeEvent } from 'react'
import { Modal } from '../../components/ui/Modal'
import { AddBottleForm, type AddBottleFormInput } from '../../components/domain/AddBottleForm'
import { downscaleImageToJpegBase64 } from '../ai/imageToBase64'
import { scanBottleLabel } from '../../data/repositories/ai'
import { uploadPhoto } from '../photoUpload/uploadPhoto'
import { cutoutBottlePhoto } from '../photoUpload/cutoutBottlePhoto'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import styles from './QuickAddFromPhotoButton.module.css'

export function QuickAddFromPhotoButton() {
  const { user } = useAuth()
  const { addBottle } = useUserData()
  const [scanning, setScanning] = useState(false)
  const [scanNotice, setScanNotice] = useState<string | null>(null)
  const [prefill, setPrefill] = useState<Partial<AddBottleFormInput>>({})
  const [showForm, setShowForm] = useState(false)

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return
    setScanning(true)
    setScanNotice(null)
    try {
      const base64 = await downscaleImageToJpegBase64(file)
      // The same photo used to scan the label also becomes the bottle's
      // display photo — a failed upload shouldn't block the scan result,
      // so it's swallowed independently rather than failing the whole flow.
      const uploadPromise = cutoutBottlePhoto(file)
        .then((cutout) => uploadPhoto(user.uid, cutout, 'bottle-photos'))
        .catch(() => undefined)
      const [info, imageUrl] = await Promise.all([scanBottleLabel(base64, 'image/jpeg'), uploadPromise])

      if (!info.found) {
        setScanNotice("Couldn't read a bottle label in that photo — fill in the details manually below.")
        setPrefill({ imageUrl })
      } else {
        setPrefill({
          name: info.name,
          distillery: info.distillery,
          type: info.type,
          region: info.region,
          proof: info.proof,
          ageStatement: info.ageStatement,
          msrp: info.msrp,
          imageUrl,
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
