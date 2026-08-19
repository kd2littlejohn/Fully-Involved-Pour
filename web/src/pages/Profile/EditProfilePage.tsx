import { useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { uploadPhoto, NotAuthenticatedError, PhotoTooLargeError, UnsupportedFileTypeError } from '../../features/photoUpload/uploadPhoto'
import { UsernameTakenError } from '../../data/repositories/username'
import { Field, controlClassName } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import styles from './EditProfilePage.module.css'

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/i
const BIO_MAX_LENGTH = 160

interface FormErrors {
  displayName?: string
  username?: string
  bio?: string
}

export function EditProfilePage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { userDoc, profile, claimUsername, updateProfile } = useUserData()

  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '')
  const [username, setUsername] = useState(userDoc.username ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [photoURL, setPhotoURL] = useState(profile?.photoURL)
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [errors, setErrors] = useState<FormErrors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoError(null)
    setPhotoUploading(true)
    try {
      const url = await uploadPhoto(user?.uid, file, 'profile-photos')
      setPhotoURL(url)
    } catch (err) {
      if (err instanceof NotAuthenticatedError || err instanceof PhotoTooLargeError || err instanceof UnsupportedFileTypeError) {
        setPhotoError(err.message)
      } else {
        setPhotoError('Could not upload that photo. Try again.')
      }
    } finally {
      setPhotoUploading(false)
    }
  }

  function validate(): boolean {
    const next: FormErrors = {}
    if (!displayName.trim()) next.displayName = 'Display name is required.'
    const trimmedUsername = username.trim()
    if (trimmedUsername && !USERNAME_PATTERN.test(trimmedUsername)) {
      next.username = 'Usernames are 3-20 letters, numbers, or underscores.'
    }
    if (bio.length > BIO_MAX_LENGTH) next.bio = `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError(null)
    if (!validate()) return

    setSaving(true)
    try {
      const trimmedUsername = username.trim()
      if (trimmedUsername && trimmedUsername !== userDoc.username) {
        await claimUsername(trimmedUsername)
      }
      await updateProfile({
        displayName: displayName.trim(),
        location: location.trim() || undefined,
        bio: bio.trim() || undefined,
        photoURL,
      })
      navigate('/profile')
    } catch (err) {
      setSubmitError(err instanceof UsernameTakenError ? err.message : 'Could not save your profile. Try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button type="button" className={styles.back} onClick={() => navigate(-1)} aria-label="Cancel">
          ×
        </button>
        <h1 className={styles.title}>Edit Profile</h1>
      </header>

      <form className={styles.form} onSubmit={(e) => void handleSubmit(e)}>
        <div className={styles.photoRow}>
          <div className={styles.photoPreview}>
            {photoURL ? (
              <img className={styles.photoImage} src={photoURL} alt="" />
            ) : (
              <span className={styles.photoPlaceholder} aria-hidden="true">
                {(displayName || '?').charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <label className={styles.photoButton}>
            {photoUploading ? 'Uploading…' : 'Change Photo'}
            <input type="file" accept="image/*" className={styles.photoInput} onChange={(e) => void handlePhotoChange(e)} disabled={photoUploading} />
          </label>
        </div>
        {photoError ? (
          <p className={styles.fieldError} role="alert">
            {photoError}
          </p>
        ) : null}

        <Field label="Display Name" htmlFor="edit-display-name" required>
          <input
            id="edit-display-name"
            className={controlClassName}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={60}
          />
        </Field>
        {errors.displayName ? (
          <p className={styles.fieldError} role="alert">
            {errors.displayName}
          </p>
        ) : null}

        <Field label="Username" htmlFor="edit-username">
          <input
            id="edit-username"
            className={controlClassName}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="whiskeywanderer"
          />
        </Field>
        {errors.username ? (
          <p className={styles.fieldError} role="alert">
            {errors.username}
          </p>
        ) : null}

        <Field label="Location" htmlFor="edit-location">
          <input
            id="edit-location"
            className={controlClassName}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, State"
            maxLength={80}
          />
        </Field>

        <Field label="Bio" htmlFor="edit-bio">
          <textarea
            id="edit-bio"
            className={controlClassName}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            maxLength={BIO_MAX_LENGTH}
          />
        </Field>
        <p className={styles.charCount}>
          {bio.length}/{BIO_MAX_LENGTH}
        </p>
        {errors.bio ? (
          <p className={styles.fieldError} role="alert">
            {errors.bio}
          </p>
        ) : null}

        {submitError ? (
          <p className={styles.fieldError} role="alert">
            {submitError}
          </p>
        ) : null}

        <div className={styles.actions}>
          <Button type="submit" disabled={saving || photoUploading}>
            {saving ? 'Saving…' : 'Save Changes'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  )
}
