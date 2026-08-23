import { useState } from 'react'
import type { FipGuide } from '../../data/repositories/fipGuide'
import type { FipGuideLoadState } from './useFipGuide'
import styles from './FipGuideSection.module.css'

interface GuideRow {
  label: string
  value: string
}

interface FipGuideSectionProps {
  state: FipGuideLoadState
  guide: FipGuide | undefined
}

// Canonical, reusable-across-users AI content — see fipGuide.ts for the
// cache-once-per-bottle contract. Data comes from useFipGuide (shared with
// Bottle Info's Availability row so both read one fetch, not two). Renders
// nothing (not an error, not a placeholder) when the bottle isn't
// confidently recognized, per "do not fabricate low-confidence facts."
export function FipGuideSection({ state, guide }: FipGuideSectionProps) {
  const [storyOpen, setStoryOpen] = useState(false)

  if (state === 'loading') {
    return (
      <div className={styles.card}>
        <p className={styles.sectionLabel}>FIP Guide</p>
        <p className={styles.loading}>Building your FIP Guide…</p>
      </div>
    )
  }

  if (state === 'none' || !guide) return null

  const rows: GuideRow[] = [
    { label: "Why It's Special", value: guide.whySpecial },
    { label: 'Best For', value: guide.bestFor },
    { label: 'Value', value: guide.value },
    { label: 'Buy If', value: guide.buyIf },
    { label: 'Skip If', value: guide.skipIf },
    { label: 'Verdict', value: guide.verdict },
  ].filter((row) => row.value.trim().length > 0)

  const hasProfile = guide.flavorProfile.length > 0

  if (rows.length === 0 && !guide.story.trim() && !hasProfile) return null

  return (
    <>
      {rows.length > 0 || guide.story.trim() ? (
        <div className={styles.card}>
          <p className={styles.sectionLabel}>FIP Guide</p>

          {rows.length > 0 ? (
            <div className={styles.rows}>
              {rows.map((row) => (
                <div className={styles.row} key={row.label}>
                  <span className={styles.rowLabel}>{row.label}</span>
                  <span className={styles.rowValue}>{row.value}</span>
                </div>
              ))}
            </div>
          ) : null}

          {guide.story.trim() ? (
            <>
              <button type="button" className={styles.storyToggle} onClick={() => setStoryOpen((v) => !v)} aria-expanded={storyOpen}>
                {storyOpen ? 'Hide the Story' : 'Read the Story'}
                <span aria-hidden="true">{storyOpen ? '↑' : '→'}</span>
              </button>
              {storyOpen ? <p className={styles.story}>{guide.story}</p> : null}
            </>
          ) : null}
        </div>
      ) : null}

      {hasProfile ? (
        <div className={styles.card}>
          <p className={styles.sectionLabel}>
            Typical Profile <span className={styles.referenceTag}>(General Reference)</span>
          </p>
          <div className={styles.profileChips}>
            {guide.flavorProfile.map((flavor) => (
              <span className={styles.profileChip} key={flavor}>
                {flavor}
              </span>
            ))}
          </div>
          {guide.intensity != null ? (
            <div className={styles.intensityRow}>
              <span className={styles.intensityLabel}>Light</span>
              <div className={styles.intensityTrack}>
                <div className={styles.intensityDot} style={{ left: `${Math.round(guide.intensity * 100)}%` }} />
              </div>
              <span className={styles.intensityLabel}>Bold</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  )
}
