import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FlavorProfileTab } from './FlavorProfileTab'
import { GuideTab } from './GuideTab'
import type { Bottle } from '../../../data/types'
import type { FipGuide } from '../../../data/repositories/fipGuide'

// Both are covered by their own tests; here they only need to render.
vi.mock('../../../features/palateMatch/PalateMatchBadge', () => ({ PalateMatchBadge: () => null }))
vi.mock('./CompareTab', () => ({ CompareTab: () => <div>Compare picker</div> }))

const bottle: Bottle = { id: 'b1', name: 'Eagle Rare', status: 'open' }

const guide: FipGuide = {
  bottleKey: 'eagle-rare::v2',
  confidence: 'high',
  story: null,
  special: ['Ten years in the barrel'],
  expectSummary: 'Cherry and leather.',
  expectFlavors: ['Cherry', 'Leather'],
  buyIf: ['You like dry bourbon'],
  passIf: [],
  verdict: 'A benchmark ten-year.',
  availability: 'Allocated',
  intensity: 0.5,
  generatedAt: 1,
}

describe('FlavorProfileTab', () => {
  it('keeps your own flavor notes apart from the general reference profile', () => {
    render(<FlavorProfileTab bottle={{ ...bottle, flavors: ['Caramel'] }} pours={[]} otherBottles={[]} guideState="ready" guide={guide} />)

    expect(screen.getByText('From your tastings')).toBeInTheDocument()
    expect(screen.getByText('Caramel')).toBeInTheDocument()
    expect(screen.getByText('(General Reference)')).toBeInTheDocument()
    expect(screen.getByText('Cherry')).toBeInTheDocument()
    // The guide itself belongs to the Guide tab.
    expect(screen.queryByText('FIP Verdict')).not.toBeInTheDocument()
    expect(screen.getByText('Compare picker')).toBeInTheDocument()
  })

  it('says when there is no personal profile yet instead of inventing one', () => {
    render(<FlavorProfileTab bottle={bottle} pours={[]} otherBottles={[]} guideState="none" guide={undefined} />)
    expect(screen.getByText(/Log a tasting with flavor notes/)).toBeInTheDocument()
  })
})

describe('GuideTab', () => {
  it('shows the FIP Guide sections without the reference profile card', () => {
    render(<GuideTab state="ready" guide={guide} />)
    expect(screen.getByText('What Makes It Special')).toBeInTheDocument()
    expect(screen.getByText('Buy If')).toBeInTheDocument()
    expect(screen.getByText('FIP Verdict')).toBeInTheDocument()
    expect(screen.queryByText('(General Reference)')).not.toBeInTheDocument()
  })

  it('shows an honest empty state when the bottle has no guide', () => {
    render(<GuideTab state="none" guide={undefined} />)
    expect(screen.getByText('No FIP Guide for this bottle yet.')).toBeInTheDocument()
  })
})
