import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import fipMonogram from '../../assets/brand/fip-icon.svg'
import { AXE_ASSETS, AxeChatTitle, AxeSymbol, AxeWordmark } from './AxeMark'

// Until the approved AXE files are added to src/assets/brand/ (see
// docs/BRAND.md), every AXE surface keeps the interim treatment and never
// an invented logo. Once they're added, update these expectations.
describe('AxeMark interim artwork', () => {
  it('has no AXE files yet, so nothing is substituted', () => {
    expect(AXE_ASSETS).toEqual({ symbol: undefined, wordmark: undefined, compactWordmark: undefined })
  })

  it('uses the approved FIP monogram for the symbol and set type for the wordmarks', () => {
    const { container } = render(
      <>
        <AxeSymbol />
        <AxeWordmark />
        <AxeChatTitle id="t" />
      </>,
    )
    expect(Array.from(container.querySelectorAll('img')).every((img) => img.getAttribute('src') === fipMonogram)).toBe(true)
    expect(screen.getByText('Your Personal Sommelier')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'AXE' })).toHaveTextContent('AXE')
  })
})
