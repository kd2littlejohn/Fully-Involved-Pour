import fipMonogram from '../../assets/brand/fip-icon.svg'
import styles from './AxeMark.module.css'

// The one place AXE's artwork comes from. Every AXE surface (centre nav
// tab, AXE Hub header, chat, insight cards) renders these components, so
// the approved AXE files drop in here and nowhere else:
//   - axe-symbol.svg   gold Glencairn glass and flame, no letters, no circle
//   - axe-wordmark.svg full "AXE" wordmark with "Your Personal Sommelier"
//   - axe-wordmark-compact.svg  compact "AXE" wordmark for the chat header
// Until those are in src/assets/brand/, the symbol uses the approved FIP
// monogram (the same glass and flame, set in the FIP letters), and the
// wordmark is set as plain text rather than an imitation logo.
const AXE_SYMBOL_SRC = fipMonogram

export function AxeSymbol({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <img
      className={className ? `${styles.symbol} ${className}` : styles.symbol}
      src={AXE_SYMBOL_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
    />
  )
}

export function AxeWordmark({ tagline = true }: { tagline?: boolean }) {
  return (
    <div className={styles.wordmark}>
      <AxeSymbol size={64} className={styles.wordmarkSymbol} />
      <span className={styles.wordmarkName}>AXE</span>
      {tagline ? <span className={styles.wordmarkTagline}>Your Personal Sommelier</span> : null}
    </div>
  )
}
