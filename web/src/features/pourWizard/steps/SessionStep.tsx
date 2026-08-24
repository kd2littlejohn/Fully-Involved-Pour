import { Field, controlClassName } from '../../../components/ui/Field'
import { useAuth } from '../../../hooks/useAuth'
import { useUserData } from '../../../hooks/useUserData'
import { TagFriendsField } from '../../friends/TagFriendsField'
import { PouredWithField } from '../PouredWithField'
import type { StepProps } from './StepProps'
import styles from './steps.module.css'

export function SessionStep({ draft, updateDraft }: StepProps) {
  const { user } = useAuth()
  const { userDoc, addOrReusePerson, updatePersonPhoto } = useUserData()

  return (
    <div className={styles.grid}>
      <Field label="Date" htmlFor="pw-date">
        <input
          id="pw-date"
          type="date"
          className={controlClassName}
          value={draft.date}
          onChange={(e) => updateDraft({ date: e.target.value })}
        />
      </Field>

      <Field label="Location" htmlFor="pw-location">
        <input
          id="pw-location"
          className={controlClassName}
          value={draft.location ?? ''}
          onChange={(e) => updateDraft({ location: e.target.value })}
          placeholder="Back porch"
        />
      </Field>

      <div className={styles.fullWidth}>
        <PouredWithField
          uid={user?.uid}
          people={userDoc.people}
          selected={draft.pouredWith ?? []}
          onChange={(pouredWith) => updateDraft({ pouredWith })}
          onCreatePerson={addOrReusePerson}
          onUpdatePersonPhoto={updatePersonPhoto}
        />
      </div>

      <Field label="Occasion" htmlFor="pw-occasion">
        <input
          id="pw-occasion"
          className={controlClassName}
          value={draft.occasion ?? ''}
          onChange={(e) => updateDraft({ occasion: e.target.value })}
          placeholder="Quiet evening"
        />
      </Field>

      <Field label="Glass" htmlFor="pw-glass">
        <input
          id="pw-glass"
          className={controlClassName}
          value={draft.glass ?? ''}
          onChange={(e) => updateDraft({ glass: e.target.value })}
          placeholder="Glencairn"
        />
      </Field>

      <Field label="Weather" htmlFor="pw-weather">
        <input
          id="pw-weather"
          className={controlClassName}
          value={draft.weather ?? ''}
          onChange={(e) => updateDraft({ weather: e.target.value })}
          placeholder="Cool evening"
        />
      </Field>

      <Field label="Mood" htmlFor="pw-mood">
        <input
          id="pw-mood"
          className={controlClassName}
          value={draft.mood ?? ''}
          onChange={(e) => updateDraft({ mood: e.target.value })}
          placeholder="Relaxed"
        />
      </Field>

      <Field label="Ounces poured" htmlFor="pw-ounces">
        <input
          id="pw-ounces"
          type="number"
          inputMode="decimal"
          className={controlClassName}
          value={draft.ounces ?? ''}
          onChange={(e) => updateDraft({ ounces: e.target.value ? Number(e.target.value) : undefined })}
          placeholder="1.5"
        />
      </Field>

      <div className={styles.fullWidth}>
        <TagFriendsField
          uid={user?.uid}
          selectedUids={draft.sharedWithUids ?? []}
          onChange={(uids) => updateDraft({ sharedWithUids: uids })}
        />
      </div>
    </div>
  )
}
