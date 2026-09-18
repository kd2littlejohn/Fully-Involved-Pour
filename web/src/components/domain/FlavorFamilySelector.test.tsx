import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { FlavorFamilySelector } from './FlavorFamilySelector'
import { FLAVOR_DESCRIPTORS, FLAVOR_FAMILIES } from '../../features/flavorTaxonomy/taxonomy'

describe('FlavorFamilySelector', () => {
  it('renders every family header, all collapsed by default when nothing is selected', () => {
    render(<FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={[]} onToggle={() => {}} />)
    for (const family of FLAVOR_FAMILIES) {
      expect(screen.getByText(family.label)).toBeInTheDocument()
    }
    // A descriptor from a collapsed family isn't rendered at all.
    expect(screen.queryByRole('button', { name: 'Vanilla' })).not.toBeInTheDocument()
  })

  it('starts a family expanded when it already contains a selected descriptor', () => {
    render(<FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={['Vanilla']} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Vanilla' })).toBeInTheDocument()
    // A different, unselected family stays collapsed.
    expect(screen.queryByRole('button', { name: 'Peat' })).not.toBeInTheDocument()
  })

  it('expands a family on click and reveals its chips', async () => {
    const user = userEvent.setup()
    render(<FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={[]} onToggle={() => {}} />)
    await user.click(screen.getByRole('button', { name: /Sweet/ }))
    expect(screen.getByRole('button', { name: 'Vanilla' })).toBeInTheDocument()
  })

  it('calls onToggle with the descriptor label and reflects active state', async () => {
    const user = userEvent.setup()
    let toggled: string | undefined
    function Wrapper() {
      return <FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={['Vanilla']} onToggle={(label) => (toggled = label)} />
    }
    render(<Wrapper />)
    const chip = screen.getByRole('button', { name: 'Vanilla' })
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    await user.click(chip)
    expect(toggled).toBe('Vanilla')
  })

  it('renders Other as a standalone chip outside any family', () => {
    render(<FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={[]} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Other' })).toBeInTheDocument()
  })

  it('renders a selected label that is not in the taxonomy as its own toggleable Legacy chip, never dropping it silently', () => {
    render(<FlavorFamilySelector descriptors={FLAVOR_DESCRIPTORS} selected={['Some Discontinued Tag']} onToggle={() => {}} />)
    const legacyChip = screen.getByRole('button', { name: 'Some Discontinued Tag' })
    expect(legacyChip).toBeInTheDocument()
    expect(legacyChip).toHaveAttribute('aria-pressed', 'true')
  })
})
