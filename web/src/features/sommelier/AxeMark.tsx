import fipMonogram from '../../assets/brand/fip-icon.svg'
import styles from './AxeMark.module.css'

// The one place AXE's interface artwork comes from. The centre nav tab, chat
// header, insight cards and inline AXE entries render these components,
// which use the official files in src/assets/brand/ (see docs/BRAND.md):
//   - axe-symbol.svg            gold Glencairn glass and flame; no letters, no circle
//   - axe-wordmark-compact.svg  compact "AXE" wordmark for the chat header
// (The AXE Hub hero is the approved hero artwork itself, src/assets/axe-hero.webp.)
// If a file is ever missing, its surface falls back to the FIP monogram
// (symbol) or set type (wordmark), never an imitation logo.
const brandFiles = import.meta.glob<string>('../../assets/brand/axe-{symbol,wordmark-compact}.svg', {
  eager: true,
  query: '?url',
  import: 'default',
})

export const AXE_ASSETS = {
  symbol: brandFiles['../../assets/brand/axe-symbol.svg'],
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

// Chat header title: the compact wordmark (set type only if the file is
// missing, in which case the chat header also shows AxeSymbol beside it).
export function AxeChatTitle({ id, className }: { id: string; className?: string }) {
  return (
    <h2 id={id} className={className}>
      {AXE_ASSETS.compactWordmark ? <img className={styles.compactImage} src={AXE_ASSETS.compactWordmark} alt="AXE" /> : 'AXE'}
    </h2>
  )
}
