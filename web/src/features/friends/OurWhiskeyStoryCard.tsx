import type { OurWhiskeyStory } from './ourWhiskeyStory'
import styles from './OurWhiskeyStoryCard.module.css'

interface OurWhiskeyStoryCardProps {
  story: OurWhiskeyStory
  friendFirstName: string
}

export function OurWhiskeyStoryCard({ story, friendFirstName }: OurWhiskeyStoryCardProps) {
  if (story.poursTogetherCount === 0 && story.blindTastingsTogetherCount === 0) {
    return (
      <div className={styles.card}>
        <div className={styles.eyebrow}>Our Whiskey Story</div>
        <p className={styles.developing}>Nothing shared yet — tag {friendFirstName} in a Pour Story to start one.</p>
      </div>
    )
  }

  return (
    <div className={styles.card}>
      <div className={styles.eyebrow}>Our Whiskey Story</div>
      <div className={styles.statsRow}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{story.poursTogetherCount}</div>
          <div className={styles.statLabel}>{story.poursTogetherCount === 1 ? 'Pour Together' : 'Pours Together'}</div>
        </div>
        {story.blindTastingsTogetherCount > 0 ? (
          <div className={styles.stat}>
            <div className={styles.statValue}>{story.blindTastingsTogetherCount}</div>
            <div className={styles.statLabel}>{story.blindTastingsTogetherCount === 1 ? 'Blind Tasting' : 'Blind Tastings'}</div>
          </div>
        ) : null}
      </div>
      {story.mostSharedBottle ? (
        <p className={styles.line}>
          Most Shared: <strong className={styles.strong}>{story.mostSharedBottle.name}</strong>
        </p>
      ) : null}
    </div>
  )
}
