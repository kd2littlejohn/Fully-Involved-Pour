import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import fipMonogram from '../../assets/brand/fip-icon.svg'
import axeSymbol from '../../assets/brand/axe-symbol.svg'
import axeWordmark from '../../assets/brand/axe-wordmark.svg'
import axeWordmarkCompact from '../../assets/brand/axe-wordmark-compact.svg'
import { AXE_ASSETS, AxeChatTitle, AxeSymbol, AxeWordmark } from './AxeMark'

// The approved AXE artwork (docs/BRAND.md) is what every AXE surface draws;
// the interim FIP monogram and set-type wordmarks are no longer used.
describe('AxeMark', () => {
  it('uses the three approved AXE files', () => {
    expect(AXE_ASSETS).toEqual({ symbol: axeSymbol, wordmark: axeWordmark, compactWordmark: axeWordmarkCompact })
  })

  it('draws the approved symbol, never the FIP monogram, without stretching it', () => {
    const { container } = render(<AxeSymbol size={48} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe(axeSymbol)
    expect(img.getAttribute('src')).not.toBe(fipMonogram)
    // Square box; the artwork keeps its own proportions inside it (object-fit: contain).
    expect(img).toHaveAttribute('width', '48')
    expect(img).toHaveAttribute('height', '48')
  })

  it('uses the full wordmark on the Hub and the compact wordmark as the chat title', () => {
    render(
      <>
        <AxeWordmark />
        <AxeChatTitle id="t" />
      </>,
    )
    expect(screen.getByAltText('AXE, Your Personal Sommelier')).toHaveAttribute('src', axeWordmark)
    const title = screen.getByRole('heading', { name: 'AXE' })
    expect(title.querySelector('img')).toHaveAttribute('src', axeWordmarkCompact)
  })
})
