import type { WhiskeyIdentity } from './identity'
import styles from './WhiskeyIdentityCard.module.css'

interface WhiskeyIdentityCardProps {
  identity?: WhiskeyIdentity
}

export function WhiskeyIdentityCard({ identity }: WhiskeyIdentityCardProps) {
  if (!identity) {
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>Your Whiskey Identity</div>
        <p className={styles.developing}>
          Your identity is still forming. Log a few more Pour Stories and we&rsquo;ll start describing your palate.
        </p>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Your Whiskey Identity</div>
      <div className={styles.tags}>
        {identity.tags.map((tag, i) => (
          <span className={styles.tag} key={tag}>
            {tag}
            {i < identity.tags.length - 1 ? (
              <span className={styles.dot} aria-hidden="true">
                {' '}
                ·{' '}
              </span>
            ) : null}
          </span>
        ))}
      </div>
      <p className={styles.description}>{identity.description}</p>
    </div>
  )
}
