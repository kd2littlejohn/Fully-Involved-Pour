import { useState, type FormEvent } from 'react'
import type { Bottle, Memory } from '../../data/types'
import type { NewMemoryInput } from '../../hooks/useUserData'
import { Field, controlClassName } from '../../components/ui/Field'
import { Button } from '../../components/ui/Button'
import { PhotoUploadField } from '../photoUpload/PhotoUploadField'
import { deletePhotoIfSafe } from '../photoUpload/uploadPhoto'
import styles from './MemoryForm.module.css'

interface MemoryFormProps {
  bottles: Bottle[]
  initial?: Memory
  onSubmit: (input: NewMemoryInput) => Promise<void>
  onCancel: () => void
}

export function MemoryForm({ bottles, initial, onSubmit, onCancel }: MemoryFormProps) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [date, setDate] = useState(initial?.date ?? new Date().toISOString().slice(0, 10))
  const [location, setLocation] = useState(initial?.location ?? '')
  const [occasion, setOccasion] = useState(initial?.occasion ?? '')
  const [people, setPeople] = useState(initial?.people.join(', ') ?? '')
  const [bottleId, setBottleId] = useState(initial?.bottleId ?? '')
  const [story, setStory] = useState(initial?.story ?? '')
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl)
  const [photoStoragePath, setPhotoStoragePath] = useState(initial?.photoStoragePath)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) {
      setError('Give this memory a title.')
      return
    }
    if (!story.trim()) {
      setError('Add the story behind this memory.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        date,
        location: location.trim() || undefined,
        occasion: occasion.trim() || undefined,
        people: people
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        bottleId: bottleId || undefined,
        story: story.trim(),
        photoUrl,
        photoStoragePath,
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <Field label="Title" htmlFor="memory-title">
        <input
          id="memory-title"
          className={controlClassName}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dad's retirement toast"
          required
        />
      </Field>

      <Field label="Date" htmlFor="memory-date">
        <input id="memory-date" type="date" className={controlClassName} value={date} onChange={(e) => setDate(e.target.value)} />
      </Field>

      <Field label="Location" htmlFor="memory-location">
        <input
          id="memory-location"
          className={controlClassName}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Back porch"
        />
      </Field>

      <Field label="Occasion" htmlFor="memory-occasion">
        <input
          id="memory-occasion"
          className={controlClassName}
          value={occasion}
          onChange={(e) => setOccasion(e.target.value)}
          placeholder="Retirement"
        />
      </Field>

      <Field label="People" htmlFor="memory-people">
        <input
          id="memory-people"
          className={controlClassName}
          value={people}
          onChange={(e) => setPeople(e.target.value)}
          placeholder="Dad, Mike"
        />
      </Field>
      <p className={styles.hint}>Separate multiple people with commas.</p>

      {bottles.length > 0 ? (
        <Field label="Bottle (optional)" htmlFor="memory-bottle">
          <select id="memory-bottle" className={controlClassName} value={bottleId} onChange={(e) => setBottleId(e.target.value)}>
            <option value="">None</option>
            {bottles.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <PhotoUploadField
        label="Photo (optional)"
        folder="memory-photos"
        currentUrl={photoUrl}
        onUploaded={(url, path) => {
          const oldPath = photoStoragePath
          setPhotoUrl(url)
          setPhotoStoragePath(path)
          if (oldPath && oldPath !== path) void deletePhotoIfSafe(oldPath)
        }}
      />

      <Field label="The story" htmlFor="memory-story">
        <textarea
          id="memory-story"
          className={controlClassName}
          rows={4}
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="What made this moment worth remembering?"
        />
      </Field>

      <div className={styles.actions}>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={submitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving…' : initial ? 'Save Changes' : 'Save Memory'}
        </Button>
      </div>
    </form>
  )
}
