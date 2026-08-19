import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useUserData } from '../../hooks/useUserData'
import { syncSharedCollection } from '../../data/repositories/sharedCollections'
import { DEFAULT_PRIVACY_SETTINGS } from '../../data/types'
import type { CollectionVisibility, PourStoryVisibility, PrivacySettings, ProfileVisibility, WishListVisibility } from '../../data/types'
import styles from './PrivacyControls.module.css'

// Every account starts on DEFAULT_PRIVACY_SETTINGS (see data/types.ts) —
// the most private option in each category — so this only ever loosens
// visibility when the user deliberately chooses to. Saving also re-syncs
// sharedCollections/{uid} (see data/repositories/sharedCollections.ts) so
// a visibility change takes effect immediately, not just on the next
// unrelated save.
export function PrivacyControls() {
  const { user } = useAuth()
  const { userDoc, profile, updateProfile } = useUserData()
  const privacy = profile?.privacy ?? DEFAULT_PRIVACY_SETTINGS
  const [saving, setSaving] = useState(false)

  async function handleChange(patch: Partial<PrivacySettings>) {
    if (!user) return
    const next: PrivacySettings = { ...privacy, ...patch }
    setSaving(true)
    try {
      await updateProfile({ privacy: next })
      await syncSharedCollection(user.uid, userDoc, next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.wrap}>
      <label className={styles.field}>
        <span className={styles.label}>Profile visibility</span>
        <select
          className={styles.select}
          value={privacy.profileVisibility}
          onChange={(e) => void handleChange({ profileVisibility: e.target.value as ProfileVisibility })}
          disabled={saving}
        >
          <option value="friends">Friends only</option>
          <option value="fip-users">FIP users</option>
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Collection visibility</span>
        <select
          className={styles.select}
          value={privacy.collectionVisibility}
          onChange={(e) => void handleChange({ collectionVisibility: e.target.value as CollectionVisibility })}
          disabled={saving}
        >
          <option value="private">Private</option>
          <option value="friends">Friends</option>
          <option value="fip-users">FIP users</option>
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Pour Story default</span>
        <select
          className={styles.select}
          value={privacy.pourStoryDefault}
          onChange={(e) => void handleChange({ pourStoryDefault: e.target.value as PourStoryVisibility })}
          disabled={saving}
        >
          <option value="private">Private</option>
          <option value="friends">Friends</option>
          <option value="selected-friends">Selected friends</option>
        </select>
        <span className={styles.hint}>You still tag exactly who to share each pour with when you log it.</span>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>Wish List visibility</span>
        <select
          className={styles.select}
          value={privacy.wishListVisibility}
          onChange={(e) => void handleChange({ wishListVisibility: e.target.value as WishListVisibility })}
          disabled={saving}
        >
          <option value="private">Private</option>
          <option value="friends">Friends</option>
        </select>
      </label>
    </div>
  )
}
