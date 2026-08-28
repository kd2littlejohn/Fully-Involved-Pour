import compassMark from '../../assets/compass-mark.png'
import styles from './PageHeader.module.css'

interface PageHeaderProps {
  eyebrow: string
  title: string
  subtitle?: string
}

// Every top-level page shares this header, which is also where the brand
// lives now that individual pages no longer paste the full logo — a very
// low-contrast compass mark sits in the background, bleeding off the
// corner, so a page still reads as FIP without ever putting the logo in
// front of the title or content (see PageHeader.module.css .watermark).
export function PageHeader({ eyebrow, title, subtitle }: PageHeaderProps) {
  return (
    <div className={styles.header}>
      <img className={styles.watermark} src={compassMark} alt="" aria-hidden="true" />
      <div className={styles.content}>
        <div className={styles.eyebrow}>{eyebrow}</div>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
      </div>
    </div>
  )
}
