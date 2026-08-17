import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PalateInsightCard, PalateInsightEmptyCard } from './PalateInsightCard'
import type { PalateInsight } from './selectors'

describe('PalateInsightCard', () => {
  it('shows the headline and both bar percentages', () => {
    const insight: PalateInsight = {
      headline: 'Woody-forward notes have come up in most of your last 5 pours.',
      primaryLabel: 'Woody-Forward',
      primaryPercent: 72,
      secondaryLabel: 'All Other Profiles',
      secondaryPercent: 28,
    }
    render(
      <MemoryRouter>
        <PalateInsightCard insight={insight} />
      </MemoryRouter>,
    )

    expect(screen.getByText(insight.headline)).toBeInTheDocument()
    expect(screen.getByText('72%')).toBeInTheDocument()
    expect(screen.getByText('28%')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'See My Journey' })).toHaveAttribute('href', '/journal')
  })
})

describe('PalateInsightEmptyCard', () => {
  it('shows the honest not-enough-data copy instead of a fabricated insight', () => {
    render(
      <MemoryRouter>
        <PalateInsightEmptyCard />
      </MemoryRouter>,
    )
    expect(screen.getByText('Keep logging pours and your palate trends will appear here.')).toBeInTheDocument()
  })
})
