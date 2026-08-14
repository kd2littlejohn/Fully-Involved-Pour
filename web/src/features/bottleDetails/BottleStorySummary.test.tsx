import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BottleStorySummary } from './BottleStorySummary'
import type { Bottle, Pour } from '../../data/types'

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open', flavors: [] }

function pour(overrides: Partial<Pour> & Pick<Pour, 'id' | 'date' | 'rating'>): Pour {
  return {
    bottleId: 'b1',
    fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: overrides.rating, noseAromas: [], palateFlavors: [] },
    ...overrides,
  }
}

describe('BottleStorySummary', () => {
  it('renders nothing when there are no pours', () => {
    const { container } = render(<BottleStorySummary bottle={bottle} pours={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('does not show First/Latest/Change with only one pour', () => {
    render(<BottleStorySummary bottle={bottle} pours={[pour({ id: 'p1', date: '2026-05-01', rating: 8.6 })]} />)
    expect(screen.queryByText('First Score')).not.toBeInTheDocument()
    expect(screen.queryByText('Change')).not.toBeInTheDocument()
  })

  it('shows First Score, Latest Score, and a signed Change once there are 2+ pours', () => {
    const pours = [
      pour({ id: 'p1', date: '2026-05-01', rating: 8.6 }),
      pour({ id: 'p2', date: '2026-06-01', rating: 9.2 }),
    ]
    render(<BottleStorySummary bottle={bottle} pours={pours} />)

    expect(screen.getByText('First Score')).toBeInTheDocument()
    expect(screen.getByText('8.6')).toBeInTheDocument()
    expect(screen.getByText('Latest Score')).toBeInTheDocument()
    expect(screen.getByText('9.2')).toBeInTheDocument()
    expect(screen.getByText('Change')).toBeInTheDocument()
    expect(screen.getByText('+0.6')).toBeInTheDocument()
  })

  it('signs a declining Change with a minus, not a double negative', () => {
    const pours = [
      pour({ id: 'p1', date: '2026-05-01', rating: 9.2 }),
      pour({ id: 'p2', date: '2026-06-01', rating: 8.6 }),
    ]
    render(<BottleStorySummary bottle={bottle} pours={pours} />)
    expect(screen.getByText('-0.6')).toBeInTheDocument()
  })

  it('is order-independent — First/Latest are by date, not array order', () => {
    const pours = [
      pour({ id: 'p2', date: '2026-06-01', rating: 9.2 }),
      pour({ id: 'p1', date: '2026-05-01', rating: 8.6 }),
    ]
    render(<BottleStorySummary bottle={bottle} pours={pours} />)
    expect(screen.getByText('+0.6')).toBeInTheDocument()
  })

  it('does not show Most Common Notes when no pour or bottle has any tags', () => {
    render(<BottleStorySummary bottle={bottle} pours={[pour({ id: 'p1', date: '2026-05-01', rating: 8.6 })]} />)
    expect(screen.queryByText('Most Common Notes')).not.toBeInTheDocument()
  })

  it('shows Most Common Notes ranked from real tagged pours', () => {
    const pours = [
      pour({ id: 'p1', date: '2026-05-01', rating: 8.6, fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: 8.6, noseAromas: ['Vanilla'], palateFlavors: ['Oak'] } }),
    ]
    render(<BottleStorySummary bottle={bottle} pours={pours} />)

    expect(screen.getByText('Most Common Notes')).toBeInTheDocument()
    expect(screen.getByText('Vanilla')).toBeInTheDocument()
    expect(screen.getByText('Oak')).toBeInTheDocument()
  })

  it('includes this bottle\'s own static flavors in its notes', () => {
    const taggedBottle: Bottle = { ...bottle, flavors: ['Leather'] }
    render(<BottleStorySummary bottle={taggedBottle} pours={[pour({ id: 'p1', date: '2026-05-01', rating: 8.6 })]} />)
    expect(screen.getByText('Leather')).toBeInTheDocument()
  })

  it('ignores tags from a pour that belongs to a different bottle', () => {
    const otherBottlePour: Pour = {
      ...pour({ id: 'p1', date: '2026-05-01', rating: 8.6 }),
      bottleId: 'other-bottle',
      fip: { nose: 2, palate: 3, finish: 1.5, complexity: 0.75, value: 0.75, total: 8.6, noseAromas: ['Peat'], palateFlavors: [] },
    }
    const { container } = render(<BottleStorySummary bottle={bottle} pours={[otherBottlePour]} />)
    // No pours for this bottle at all -> nothing renders, including the
    // unrelated pour's "Peat" tag.
    expect(container).toBeEmptyDOMElement()
  })
})
