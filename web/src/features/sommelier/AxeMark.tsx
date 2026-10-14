import fipMonogram from '../../assets/brand/fip-icon.svg'
import styles from './AxeMark.module.css'

// The one place AXE's artwork comes from. Every AXE surface (centre nav
// tab, AXE Hub header, chat header, insight cards, inline AXE entries)
// renders these components. The approved files are picked up
// automatically once they're added to src/assets/brand/ — no code change:
//   - axe-symbol.svg            gold Glencairn glass and flame; no letters, no circle
//   - axe-wordmark.svg          full "AXE" wordmark with "Your Personal Sommelier"
//   - axe-wordmark-compact.svg  compact "AXE" wordmark for the chat header
// Until a file is there, its surface keeps the interim treatment: the
// approved FIP monogram for the symbol (the same glass and flame, set in
// the FIP letters), and plain set type for the wordmarks — never an
// imitation logo. See docs/BRAND.md.
const brandFiles = import.meta.glob<string>('../../assets/brand/axe-*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const AXE_ASSETS = {
  symbol: brandFiles['../../assets/brand/axe-symbol.svg'],
  wordmark: brandFiles['../../assets/brand/axe-wordmark.svg'],
  compactWordmark: brandFiles['../../assets/brand/axe-wordmark-compact.svg'],
}

export function AxeSymbol({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      className={className ? `${styles.symbol} ${className}` : styles.symbol}
      src={AXE_ASSETS.symbol ?? fipMonogram}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
    />
  )
}

// AXE Hub header.
export function AxeWordmark({ tagline = true }: { tagline?: boolean }) {
  if (AXE_ASSETS.wordmark) {
    return (
      <div className={styles.wordmark}>
        <img className={styles.wordmarkImage} src={AXE_ASSETS.wordmark} alt={tagline ? 'AXE, Your Personal Sommelier' : 'AXE'} />
      </div>
    )
  }
  return (
    <div className={styles.wordmark}>
      <AxeSymbol size={64} className={styles.wordmarkSymbol} />
      <span className={styles.wordmarkName}>AXE</span>
      {tagline ? <span className={styles.wordmarkTagline}>Your Personal Sommelier</span> : null}
    </div>
  )
}

// Chat header title: the compact wordmark once supplied, set type until
// then. (The chat header shows AxeSymbol beside it only in the interim.)
export function AxeChatTitle({ id, className }: { id: string; className?: string }) {
  return (
    <h2 id={id} className={className}>
      {AXE_ASSETS.compactWordmark ? <img className={styles.compactImage} src={AXE_ASSETS.compactWordmark} alt="AXE" /> : 'AXE'}
    </h2>
  )
}
