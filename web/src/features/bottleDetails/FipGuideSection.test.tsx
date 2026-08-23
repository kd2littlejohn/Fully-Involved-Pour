import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FipGuideSection } from './FipGuideSection'
import type { FipGuide } from '../../data/repositories/fipGuide'

function fullGuide(overrides: Partial<FipGuide> = {}): FipGuide {
  return {
    bottleKey: 'eagle-rare-10-year__buffalo-trace-distillery::v2',
    confidence: 'high',
    story: 'Eagle Rare has been a Buffalo Trace mainstay for decades, prized for consistency at a fair price.',
    special: ['10-year age statement in a category full of NAS bottles', 'Consistently allocated but not chased like its siblings'],
    expectSummary: 'Balanced caramel and oak with light dried fruit and a smooth, warming finish.',
    expectFlavors: ['Caramel', 'Vanilla', 'Cherry', 'Oak', 'Baking Spice'],
    buyIf: ['You want a balanced, approachable age-stated bourbon.', 'You are building a reliable everyday rotation.'],
    passIf: ['You prefer high proof or heavily finished whiskey.'],
    verdict: 'Worth buying near retail.',
    availability: 'Limited',
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

  it('renders every FIP Guide section using the desired v2 hierarchy', async () => {
    render(<FipGuideSection state="ready" guide={fullGuide()} />)

    expect(screen.getByText('FIP Guide')).toBeInTheDocument()

    // Story is collapsed by default.
    expect(screen.queryByText(/Eagle Rare has been a Buffalo Trace mainstay/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Read the Story/ }))
    expect(screen.getByText(/Eagle Rare has been a Buffalo Trace mainstay/)).toBeInTheDocument()

    expect(screen.getByText('What Makes It Special')).toBeInTheDocument()
    expect(screen.getByText('10-year age statement in a category full of NAS bottles')).toBeInTheDocument()
    expect(screen.getByText('Consistently allocated but not chased like its siblings')).toBeInTheDocument()

    expect(screen.getByText('What to Expect')).toBeInTheDocument()
    expect(screen.getByText('Balanced caramel and oak with light dried fruit and a smooth, warming finish.')).toBeInTheDocument()

    expect(screen.getByText('Buy If')).toBeInTheDocument()
    expect(screen.getByText('You want a balanced, approachable age-stated bourbon.')).toBeInTheDocument()
    expect(screen.getByText('You are building a reliable everyday rotation.')).toBeInTheDocument()

    expect(screen.getByText('Pass If')).toBeInTheDocument()
    expect(screen.getByText('You prefer high proof or heavily finished whiskey.')).toBeInTheDocument()

    expect(screen.getByText('FIP Verdict')).toBeInTheDocument()
    expect(screen.getByText('Worth buying near retail.')).toBeInTheDocument()
  })

  it('only shows sections that actually have content, never an empty heading', () => {
    render(<FipGuideSection state="ready" guide={fullGuide({ passIf: [], special: [] })} />)

    expect(screen.queryByText('Pass If')).not.toBeInTheDocument()
    expect(screen.queryByText('What Makes It Special')).not.toBeInTheDocument()
    expect(screen.getByText('Buy If')).toBeInTheDocument()
  })

  it('does not offer Read the Story when the guide has no story', () => {
    render(<FipGuideSection state="ready" guide={fullGuide({ story: null })} />)

    expect(screen.queryByRole('button', { name: /Read the Story/ })).not.toBeInTheDocument()
  })

  it('shows the Typical Profile flavor chips clearly labeled as general reference', () => {
    render(<FipGuideSection state="ready" guide={fullGuide()} />)

    expect(screen.getByText('Typical Profile')).toBeInTheDocument()
    expect(screen.getByText('(General Reference)')).toBeInTheDocument()
    // Shown once in "What to Expect" and again in the Typical Profile card.
    expect(screen.getAllByText('Baking Spice').length).toBe(2)
  })

  it('omits Typical Profile entirely when the guide has no flavor profile', () => {
    render(<FipGuideSection state="ready" guide={fullGuide({ expectFlavors: [] })} />)

    expect(screen.queryByText('Typical Profile')).not.toBeInTheDocument()
  })

  it('renders nothing at all if a "ready" guide somehow has no usable content', () => {
    const { container } = render(
      <FipGuideSection
        state="ready"
        guide={fullGuide({
          story: null,
          special: [],
          expectSummary: '',
          expectFlavors: [],
          buyIf: [],
          passIf: [],
          verdict: '',
        })}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('never renders an AI or Gemini brand label anywhere in the section', () => {
    render(<FipGuideSection state="ready" guide={fullGuide()} />)

    expect(screen.queryByText(/gemini/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^ai$/i)).not.toBeInTheDocument()
  })
})
