import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { PalateInsightCard, PalateInsightEmptyCard } from './PalateInsightCard'
import type { PalateInsight } from './selectors'

describe('PalateInsightCard', () => {
  it('shows the headline and both bar percentages', () => {
    const insight: PalateInsight = {
      kind: 'flavor',
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

describe('PalateInsightCard — rating-based summary', () => {
  it('shows the summary, its supporting lines and the flavor note, with no flavor bars', () => {
    const insight: PalateInsight = {
      kind: 'summary',
      headline: "You've logged 12 pours so far, averaging 8.0 — Working Fire.",
      details: ['Your ratings have stayed fairly consistent.', 'You seem to enjoy Bourbon the most — averaging 8.3 across 6 pours.'],
      flavorNote: 'Add flavor notes when you log a pour to see your flavor trends here.',
    }
    render(
      <MemoryRouter>
        <PalateInsightCard insight={insight} />
      </MemoryRouter>,
    )
    expect(screen.getByText(insight.headline)).toBeInTheDocument()
    for (const line of insight.details) expect(screen.getByText(line)).toBeInTheDocument()
    expect(screen.getByText(insight.flavorNote)).toBeInTheDocument()
    expect(screen.queryByText('All Other Profiles')).not.toBeInTheDocument()
    expect(screen.queryByText('Keep logging pours and your palate trends will appear here.')).not.toBeInTheDocument()
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
