import { useState, type KeyboardEvent } from 'react'
import { Field, controlClassName } from '../../components/ui/Field'
import { PersonAvatar } from '../../components/ui/PersonAvatar'
import { uploadPhoto, deletePhotoIfSafe } from '../photoUpload/uploadPhoto'
import { PhotoActionSheet } from './PhotoActionSheet'
import { normalizePersonName, findMatchingPerson } from './pourPeople'
import type { PourPerson, PourPersonRef } from '../../data/types'
import styles from './PouredWithField.module.css'

interface PouredWithFieldProps {
  uid: string | undefined
  people: PourPerson[]
  selected: PourPersonRef[]
  onChange: (next: PourPersonRef[]) => void
  onCreatePerson: (name: string) => Promise<PourPerson | undefined>
  onUpdatePersonPhoto: (personId: string, photo: { photoUrl: string; photoStoragePath?: string } | undefined) => Promise<void>
}

// Contact-style "Poured With" picker — reusable people with optional
// avatars, distinct from both the free-text `companion` mirror this writes
// alongside (for backward compatibility, see PourWizard.tsx) and
// `sharedWithUids`/TagFriendsField (real FIP friend accounts, a separate
// concept rendered elsewhere in this step, untouched by this field).
export function PouredWithField({ uid, people, selected, onChange, onCreatePerson, onUpdatePersonPhoto }: PouredWithFieldProps) {
  const [text, setText] = useState('')
  const [creating, setCreating] = useState(false)
  const [photoSheetPersonId, setPhotoSheetPersonId] = useState<string | null>(null)
  const [uploadingPhotoFor, setUploadingPhotoFor] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const selectedIds = new Set(selected.map((ref) => ref.personId).filter((id): id is string => Boolean(id)))
  const query = normalizePersonName(text)
  const suggestions = query ? people.filter((p) => !selectedIds.has(p.id) && p.normalizedName.includes(query)) : []
  const exactMatch = findMatchingPerson(people, text)

  async function addPerson(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    setCreating(true)
    setError(null)
    try {
      const person = await onCreatePerson(trimmed)
      if (person) onChange([...selected, { personId: person.id, name: person.name }])
      setText('')
    } finally {
      setCreating(false)
    }
  }

  function selectSuggestion(person: PourPerson) {
    onChange([...selected, { personId: person.id, name: person.name }])
    setText('')
  }

  function removeSelected(index: number) {
    onChange(selected.filter((_, i) => i !== index))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter') return
    event.preventDefault()
    if (exactMatch && !selectedIds.has(exactMatch.id)) {
      selectSuggestion(exactMatch)
    } else if (!exactMatch) {
      void addPerson(text)
    }
  }

  // A chip for a still-unlinked legacy name (parsed from an old pour's
  // companion string, no personId yet) creates/links a real person the
  // first time its avatar is tapped, then opens the sheet for that person.
  async function openPhotoSheet(index: number) {
    const ref = selected[index]
    if (!ref) return
    let personId = ref.personId
    if (!personId) {
      const person = await onCreatePerson(ref.name)
      if (!person) return
      personId = person.id
      const next = [...selected]
      next[index] = { personId: person.id, name: person.name }
      onChange(next)
    }
    setPhotoSheetPersonId(personId)
  }

  async function handleAvatarFile(personId: string, file: File) {
    if (!uid) return
    setUploadingPhotoFor(personId)
    setError(null)
    try {
      const oldPath = people.find((p) => p.id === personId)?.photoStoragePath
      const { url, path } = await uploadPhoto(uid, file, 'person-photos')
      await onUpdatePersonPhoto(personId, { photoUrl: url, photoStoragePath: path })
      if (oldPath && oldPath !== path) void deletePhotoIfSafe(oldPath)
    } catch (err) {
      console.error('[PouredWithField] avatar upload failed', { personId, err })
      setError('Could not upload that photo. Try again.')
    } finally {
      setUploadingPhotoFor(null)
    }
  }

  async function handleRemovePhoto(personId: string) {
    const oldPath = people.find((p) => p.id === personId)?.photoStoragePath
    await onUpdatePersonPhoto(personId, undefined)
    if (oldPath) void deletePhotoIfSafe(oldPath)
  }

  const sheetPerson = photoSheetPersonId ? people.find((p) => p.id === photoSheetPersonId) : undefined

  return (
    <Field label="Poured With" htmlFor="pw-poured-with">
      {selected.length > 0 ? (
        <div className={styles.chips}>
          {selected.map((ref, index) => {
            const person = ref.personId ? people.find((p) => p.id === ref.personId) : undefined
            return (
              <div className={styles.chip} key={`${ref.personId ?? ref.name}-${index}`}>
                <PersonAvatar
                  name={ref.name}
                  photoUrl={person?.photoUrl}
                  size={32}
                  onClick={() => void openPhotoSheet(index)}
                />
                <span className={styles.chipName}>{ref.name}</span>
                {uploadingPhotoFor === ref.personId ? (
                  <span className={styles.chipStatus}>Uploading…</span>
                ) : (
                  <button type="button" className={styles.chipRemove} onClick={() => removeSelected(index)} aria-label={`Remove ${ref.name}`}>
                    ×
                  </button>
                )}
              </div>
            )
          })}
        </div>
      ) : null}

      <input
        id="pw-poured-with"
        className={controlClassName}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Add someone…"
        disabled={creating}
      />

      {query && (suggestions.length > 0 || !exactMatch) ? (
        <div className={styles.suggestions}>
          {suggestions.map((person) => (
            <button type="button" key={person.id} className={styles.suggestion} onClick={() => selectSuggestion(person)}>
              <PersonAvatar name={person.name} photoUrl={person.photoUrl} size={28} />
              <span>{person.name}</span>
            </button>
          ))}
          {!exactMatch ? (
            <button type="button" className={styles.suggestion} onClick={() => void addPerson(text)} disabled={creating}>
              Add “{text.trim()}”
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {photoSheetPersonId ? (
        <PhotoActionSheet
          title={sheetPerson?.name ?? 'Photo'}
          hasPhoto={Boolean(sheetPerson?.photoUrl)}
          onFile={(file) => void handleAvatarFile(photoSheetPersonId, file)}
          onRemove={() => void handleRemovePhoto(photoSheetPersonId)}
          onClose={() => setPhotoSheetPersonId(null)}
        />
      ) : null}
    </Field>
  )
}
