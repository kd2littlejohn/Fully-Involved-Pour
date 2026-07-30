import { colorForTag } from './tagColors'
import styles from './TastingGradient.module.css'

interface TastingGradientProps {
  tags: string[]
}

export function TastingGradient({ tags }: TastingGradientProps) {
  if (tags.length === 0) return null

  const colors = tags.map(colorForTag)
  const background = colors.length === 1 ? colors[0] : `linear-gradient(90deg, ${colors.join(', ')})`

  return (
    <div className={styles.wrap}>
      <div className={styles.bar} style={{ background }} />
      <div className={styles.legend}>
        {tags.map((tag, index) => (
          <span className={styles.legendItem} key={`${tag}-${index}`}>
            <span className={styles.swatch} style={{ background: colors[index] }} />
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}
