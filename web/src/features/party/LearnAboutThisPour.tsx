import { useEffect, useState } from 'react'
import { getCachedFipGuide, type FipGuide } from '../../data/repositories/fipGuide'
import { pourEducation } from './pourEducation'
import type { PartyPublicBottle } from './types'
import s from './scoring.module.css'
import styles from './party.module.css'

// Optional education for a Dual Experience GUIDED pour: the style, its
// grain and barrel, what to look for, and (collapsed until asked) common
// tasting notes. Rendered only for guided tasters, from bottles only they
// can read; blind tasters never get this component.
export function LearnAboutThisPour({ bottle, categoryName }: { bottle: PartyPublicBottle; categoryName: string }) {
  const education = pourEducation(bottle, categoryName)
  const [guide, setGuide] = useState<FipGuide | null>(null)
  const [open, setOpen] = useState(false)

  // A FIP Guide another member already generated for this exact bottle,
  // read from the shared cache once the section is opened. Never generated
  // here, so opening it costs nothing.
  useEffect(() => {
    if (!open) return
    let cancelled = false
    getCachedFipGuide(bottle.name, bottle.distillery)
      .then((g) => !cancelled && setGuide(g ?? null))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [open, bottle.name, bottle.distillery])

  return (
    <details className={s.family} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary>Learn About This Pour</summary>
      <div className={styles.stack} style={{ gap: 'var(--fip-space-2)' }}>
        <p className={styles.muted}>
          <strong className={s.learnTerm}>Style:</strong> {education.style}
        </p>
        <p className={styles.muted}>
          <strong className={s.learnTerm}>Grain:</strong> {education.grain}
        </p>
        <p className={styles.muted}>
          <strong className={s.learnTerm}>Barrel:</strong> {education.barrel}
        </p>
        <p className={styles.muted}>
          <strong className={s.learnTerm}>Aroma:</strong> {education.aroma}
        </p>
        {education.tip ? <p className={styles.muted}>{education.tip}</p> : null}
        <details className={s.family}>
          <summary>Suggested tasting notes</summary>
          <p className={styles.muted}>Taste first, then peek. Common notes for this style:</p>
          <div className={s.chips}>
            {education.descriptors.map((d) => (
              <span key={d} className={styles.pill}>
                {d}
              </span>
            ))}
          </div>
          {guide?.expectFlavors?.length ? (
            <>
              <p className={styles.muted}>From the FIP Guide for {bottle.name}:</p>
              <div className={s.chips}>
                {guide.expectFlavors.slice(0, 8).map((d) => (
                  <span key={d} className={styles.pill}>
                    {d}
                  </span>
                ))}
              </div>
            </>
          ) : null}
        </details>
        <p className={styles.muted} style={{ fontSize: 'var(--fip-text-xs)' }}>
          General notes about the style, not a verdict on this bottle. Your own palate is what counts.
        </p>
      </div>
    </details>
  )
}
