import { Field, controlClassName } from '../../../components/ui/Field'
import { Combobox, type ComboboxOption } from '../../../components/ui/Combobox'
import { useAuth } from '../../../hooks/useAuth'
import { useFriends } from '../../friends/useFriends'
import { TagFriendsField } from '../../friends/TagFriendsField'
import type { StepProps } from './StepProps'
import styles from './steps.module.css'

export function SessionStep({ draft, updateDraft }: StepProps) {
  const { user } = useAuth()
  const { friends } = useFriends(user?.uid)

  // When picking a second (or third) friend, only the text after the last
  // comma is what the user is actively typing — the earlier picks
  // ("Dad, ") shouldn't be re-matched against. Typing "Dad, Kev" should
  // suggest Kevin, not re-search the whole string against every name.
  function currentSegment(value: string): string {
    const lastComma = value.lastIndexOf(',')
    return lastComma === -1 ? value : value.slice(lastComma + 1)
  }

  // Focusing the empty field (or typing a few letters) surfaces real
  // friends to pick from — "cycling through" the friends list — without
  // forcing every pour to have a real friend attached: typing your own
  // free text ("Dad, alone, firehouse crew…") and ignoring the list
  // entirely still works exactly as before, same as the Distillery
  // combobox elsewhere in this wizard. Friends already picked drop out of
  // the suggestions so the same person can't be added twice.
  function friendOptions(query: string): ComboboxOption[] {
    const q = currentSegment(query).trim().toLowerCase()
    const alreadyAdded = new Set(draft.sharedWithUids ?? [])
    return friends
      .filter((friend) => !alreadyAdded.has(friend.uid))
      .filter((friend) => !q || (friend.displayName || friend.username || '').toLowerCase().includes(q))
      .map((friend) => ({ id: friend.uid, label: friend.displayName || friend.username || 'FIP Friend' }))
  }

  // Picking a real friend appends their name after the last comma rather
  // than replacing the whole field, so selecting several friends in a row
  // reads as "Dad, Kevin Littlejohn" instead of the field just showing
  // whichever name was picked most recently. Leaves a trailing ", " so the
  // suggestion list immediately shows the remaining friends (see
  // currentSegment above) instead of requiring the user to type a comma
  // themselves before picking the next one — the trailing separator is
  // stripped when the pour is actually saved (see PourWizard.tsx). Also
  // tags them (same sharedWithUids the chip picker below writes to — see
  // features/friends/TagFriendsField.tsx), so choosing "Dad" here doesn't
  // require separately tapping his chip too. Never touches companion's own
  // free-text meaning otherwise; typing without selecting a suggestion
  // still just sets plain text, same as before.
  function handleCompanionSelect(option: ComboboxOption) {
    const uids = draft.sharedWithUids ?? []
    const nextUids = uids.includes(option.id) ? uids : [...uids, option.id]

    const current = draft.companion ?? ''
    const lastComma = current.lastIndexOf(',')
    const prefix = lastComma === -1 ? '' : `${current.slice(0, lastComma)}, `

    updateDraft({ companion: `${prefix}${option.label}, `, sharedWithUids: nextUids })
  }

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

      <Field label="With" htmlFor="pw-companion">
        <Combobox
          id="pw-companion"
          value={draft.companion ?? ''}
          onChange={(value) => updateDraft({ companion: value })}
          onSelect={handleCompanionSelect}
          getOptions={friendOptions}
          placeholder="Dad, alone, firehouse crew…"
        />
      </Field>

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
