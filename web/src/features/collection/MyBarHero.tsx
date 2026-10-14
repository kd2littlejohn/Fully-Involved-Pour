import type { ReactNode } from 'react'
import myBarHeroImage from '../../assets/my-bar-hero.webp'
import styles from './MyBarHero.module.css'

interface MyBarHeroProps {
  subtitle?: string
  // The collection summary, shown under the title over the hero.
  children?: ReactNode
}

// My Bar's cinematic header: the lounge side of the approved FIP artwork
// (lamp, Chesterfield, Glencairn, decanter, lit shelves; the logo stays on
// Home) behind the page title and the collection summary. The art is
// decorative, never stretched, and only feathered where it meets the page.
// Phones: the art runs full width from the top of the screen, behind the
// top bar, with the title over its lower edge. Wider screens: the art sits
// on the right, the title and summary on the left over its dark side.
export function MyBarHero({ subtitle, children }: MyBarHeroProps) {
  return (
    <div className={styles.hero}>
      <img className={styles.art} src={myBarHeroImage} alt="" aria-hidden="true" width={820} height={667} />
      <div className={styles.content}>
        <div className={styles.eyebrow}>My Bar</div>
        <h1 className={styles.title}>Your bottles.</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {children ? <div className={styles.summary}>{children}</div> : null}
      </div>
    </div>
  )
}
