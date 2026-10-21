import heroLarge from '../../assets/tasting-room-hero.webp'
import heroMedium from '../../assets/tasting-room-hero-1152.webp'
import heroSmall from '../../assets/tasting-room-hero-768.webp'
import styles from './TastingRoomHero.module.css'

// The Tasting Room's approved hero artwork. Its title, tagline and
// description are painted into the image, so nothing is laid over it and
// it is never cropped: the whole composition scales with the column. The
// same words are given to screen readers as real (visually hidden) text,
// and the alt text describes the scene rather than repeating them.
export function TastingRoomHero() {
  return (
    <header className={styles.hero}>
      <h1 className={styles.srOnly}>Tasting Room</h1>
      <p className={styles.srOnly}>
        Good whiskey tastes even better together. Explore new bottles, share your notes, and create unforgettable tasting
        experiences with friends.
      </p>
      <img
        className={styles.art}
        src={heroLarge}
        srcSet={`${heroSmall} 768w, ${heroMedium} 1152w, ${heroLarge} 1536w`}
        sizes="(min-width: 1008px) 960px, calc(100vw - 48px)"
        width={1536}
        height={1024}
        alt="A whiskey flight of three Glencairn glasses on a wooden board in a warm, lamp-lit lounge, with bottles and a leather tasting journal beside them."
        decoding="async"
        fetchPriority="high"
      />
    </header>
  )
}
