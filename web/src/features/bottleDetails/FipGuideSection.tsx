import { useState } from 'react'
import type { FipGuide } from '../../data/repositories/fipGuide'
import type { FipGuideLoadState } from './useFipGuide'
import styles from './FipGuideSection.module.css'

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

  const special = guide.special.filter((item) => item.trim().length > 0)
  const buyIf = guide.buyIf.filter((item) => item.trim().length > 0)
  const passIf = guide.passIf.filter((item) => item.trim().length > 0)
  const hasStory = Boolean(guide.story && guide.story.trim().length > 0)
  const hasExpect = guide.expectSummary.trim().length > 0 || guide.expectFlavors.length > 0
  const hasVerdict = guide.verdict.trim().length > 0
  const hasProfile = guide.expectFlavors.length > 0
  const hasGuideContent = hasStory || special.length > 0 || hasExpect || buyIf.length > 0 || passIf.length > 0 || hasVerdict

  if (!hasGuideContent && !hasProfile) return null

  return (
    <>
      {hasGuideContent ? (
        <div className={styles.card}>
          <p className={styles.sectionLabel}>FIP Guide</p>

          {hasStory ? (
            <div className={styles.section}>
              <button type="button" className={styles.storyToggle} onClick={() => setStoryOpen((v) => !v)} aria-expanded={storyOpen}>
                {storyOpen ? 'Hide the Story' : 'Read the Story'}
                <span aria-hidden="true">{storyOpen ? '↑' : '→'}</span>
              </button>
              {storyOpen ? <p className={styles.story}>{guide.story}</p> : null}
            </div>
          ) : null}

          {special.length > 0 ? (
            <div className={styles.section}>
              <p className={styles.subheading}>What Makes It Special</p>
              <ul className={styles.bulletList}>
                {special.map((item, index) => (
                  <li className={styles.bulletItem} key={index}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasExpect ? (
            <div className={styles.section}>
              <p className={styles.subheading}>What to Expect</p>
              {guide.expectSummary.trim() ? <p className={styles.expectSummary}>{guide.expectSummary}</p> : null}
              {guide.expectFlavors.length > 0 ? (
                <div className={styles.profileChips}>
                  {guide.expectFlavors.map((flavor) => (
                    <span className={styles.profileChip} key={flavor}>
                      {flavor}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {buyIf.length > 0 ? (
            <div className={styles.section}>
              <p className={styles.subheading}>Buy If</p>
              <ul className={styles.bulletList}>
                {buyIf.map((item, index) => (
                  <li className={styles.bulletItem} key={index}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {passIf.length > 0 ? (
            <div className={styles.section}>
              <p className={styles.subheading}>Pass If</p>
              <ul className={styles.bulletList}>
                {passIf.map((item, index) => (
                  <li className={styles.bulletItem} key={index}>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasVerdict ? (
            <div className={styles.section}>
              <p className={styles.subheading}>FIP Verdict</p>
              <p className={styles.verdict}>{guide.verdict}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      {hasProfile ? (
        <div className={styles.card}>
          <p className={styles.sectionLabel}>
            Typical Profile <span className={styles.referenceTag}>(General Reference)</span>
          </p>
          <div className={styles.profileChips}>
            {guide.expectFlavors.map((flavor) => (
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
