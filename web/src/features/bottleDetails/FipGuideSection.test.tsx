import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FipGuideSection } from './FipGuideSection'
import type { FipGuide } from '../../data/repositories/fipGuide'

function fullGuide(overrides: Partial<FipGuide> = {}): FipGuide {
  return {
    bottleKey: 'eagle-rare-10-year__buffalo-trace-distillery',
    whySpecial: '10-year age statement with a classic Buffalo Trace profile.',
    bestFor: 'Bourbon drinkers who enjoy caramel, fruit, and oak.',
    value: 'Strong near MSRP.',
    buyIf: 'You want a balanced, approachable age-stated bourbon.',
    skipIf: 'You prefer high proof or heavily finished whiskey.',
    verdict: 'Worth buying near retail.',
    story: 'Eagle Rare has been a Buffalo Trace mainstay for decades, prized for consistency at a fair price.',
    availability: 'Limited',
    flavorProfile: ['Caramel', 'Vanilla', 'Cherry', 'Oak', 'Baking Spice'],
    intensity: 0.6,
    generatedAt: Date.now(),
    ...overrides,
  }
}

describe('FipGuideSection', () => {
  it('shows a brief loading state while the guide resolves', () => {
    render(<FipGuideSection state="loading" guide={undefined} />)

    expect(screen.getByText('Building your FIP Guide…')).toBeInTheDocument()
  })

  it('renders nothing when the bottle is not confidently recognized', () => {
    const { container } = render(<FipGuideSection state="none" guide={undefined} />)

    expect(container).toBeEmptyDOMElement()
  })

  it('renders every FIP Guide row using the exact required structure', () => {
    render(<FipGuideSection state="ready" guide={fullGuide()} />)

    expect(screen.getByText('FIP Guide')).toBeInTheDocument()
    expect(screen.getByText("Why It's Special")).toBeInTheDocument()
    expect(screen.getByText('10-year age statement with a classic Buffalo Trace profile.')).toBeInTheDocument()
    expect(screen.getByText('Best For')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
    expect(screen.getByText('Buy If')).toBeInTheDocument()
    expect(screen.getByText('Skip If')).toBeInTheDocument()
    expect(screen.getByText('Verdict')).toBeInTheDocument()
    expect(screen.getByText('Worth buying near retail.')).toBeInTheDocument()
  })

  it('only shows rows that actually have content, never a blank row', () => {
    render(<FipGuideSection state="ready" guide={fullGuide({ skipIf: '', value: '' })} />)

    expect(screen.queryByText('Skip If')).not.toBeInTheDocument()
    expect(screen.queryByText('Value')).not.toBeInTheDocument()
    expect(screen.getByText('Best For')).toBeInTheDocument()
  })

  it('keeps the story collapsed by default and expands it on tap', async () => {
    render(<FipGuideSection state="ready" guide={fullGuide()} />)

    expect(screen.queryByText(/Eagle Rare has been a Buffalo Trace mainstay/)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Read the Story/ }))

    expect(screen.getByText(/Eagle Rare has been a Buffalo Trace mainstay/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Hide the Story/ })).toBeInTheDocument()
  })

  it('does not offer Read the Story when the guide has no story', () => {
    render(<FipGuideSection state="ready" guide={fullGuide({ story: '' })} />)

    expect(screen.queryByRole('button', { name: /Read the Story/ })).not.toBeInTheDocument()
  })

  it('shows the Typical Profile flavor chips clearly labeled as general reference', () => {
    render(<FipGuideSection state="ready" guide={fullGuide()} />)

    expect(screen.getByText('Typical Profile')).toBeInTheDocument()
    expect(screen.getByText('(General Reference)')).toBeInTheDocument()
    expect(screen.getByText('Caramel')).toBeInTheDocument()
    expect(screen.getByText('Baking Spice')).toBeInTheDocument()
  })

  it('omits Typical Profile entirely when the guide has no flavor profile', () => {
    render(<FipGuideSection state="ready" guide={fullGuide({ flavorProfile: [] })} />)

    expect(screen.queryByText('Typical Profile')).not.toBeInTheDocument()
  })

  it('renders nothing at all if a "ready" guide somehow has no usable content', () => {
    const { container } = render(
      <FipGuideSection
        state="ready"
        guide={fullGuide({ whySpecial: '', bestFor: '', value: '', buyIf: '', skipIf: '', verdict: '', story: '', flavorProfile: [] })}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
