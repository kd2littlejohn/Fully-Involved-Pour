import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { RarityBadge } from './RarityBadge'

describe('RarityBadge', () => {
  it('shows the confirmed rarity level', () => {
    render(<RarityBadge bottle={{ rarity: 'rare', raritySource: 'manual' }} />)
    expect(screen.getByText('Rare')).toBeInTheDocument()
  })

  it('shows Unclassified when there is no rarity at all', () => {
    render(<RarityBadge bottle={{ rarity: undefined, raritySource: undefined }} />)
    expect(screen.getByText('Unclassified')).toBeInTheDocument()
  })

  it('shows Unclassified when rarity is set but raritySource is missing (inconsistent/legacy data)', () => {
    render(<RarityBadge bottle={{ rarity: 'rare', raritySource: undefined }} />)
    expect(screen.getByText('Unclassified')).toBeInTheDocument()
  })
})
