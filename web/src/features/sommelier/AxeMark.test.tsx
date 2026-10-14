import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import fipMonogram from '../../assets/brand/fip-icon.svg'
import axeSymbol from '../../assets/brand/axe-symbol.svg'
import axeWordmarkCompact from '../../assets/brand/axe-wordmark-compact.svg'
import { AXE_ASSETS, AxeChatTitle, AxeSymbol } from './AxeMark'

// The approved AXE artwork (docs/BRAND.md) is what every small AXE surface
// draws; the interim FIP monogram and set-type wordmark are no longer used.
describe('AxeMark', () => {
  it('uses the approved symbol and compact wordmark files', () => {
    expect(AXE_ASSETS).toEqual({ symbol: axeSymbol, compactWordmark: axeWordmarkCompact })
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

  it('uses the compact wordmark as the chat title', () => {
    render(<AxeChatTitle id="t" />)
    const title = screen.getByRole('heading', { name: 'AXE' })
    expect(title.querySelector('img')).toHaveAttribute('src', axeWordmarkCompact)
  })
})
