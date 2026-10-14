import myBarHeroImage from '../../assets/my-bar-hero.webp'
import styles from './MyBarHero.module.css'

interface MyBarHeroProps {
  subtitle?: string
}

// My Bar's cinematic header. The background is a decorative photograph
// (leather journal embossed "Every Pour Has a Story", FIP Glencairn,
// decanter) with no interface text baked in; the eyebrow, title and
// subtitle are real text laid over its dark left side. The art keeps its
// own proportions and is only feathered where it meets the page.
export function MyBarHero({ subtitle }: MyBarHeroProps) {
  return (
    <div className={styles.hero}>
      <img
        className={styles.art}
        src={myBarHeroImage}
        alt=""
        aria-hidden="true"
        width={1236}
        height={736}
        decoding="async"
        fetchPriority="high"
      />
      <div className={styles.content}>
        <div className={styles.eyebrow}>My Bar</div>
        <h1 className={styles.title}>
          Your Bottles<span className={styles.dot}>.</span>
        </h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </div>
  )
}
