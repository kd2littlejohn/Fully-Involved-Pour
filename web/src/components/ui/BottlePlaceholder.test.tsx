import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { BottlePlaceholder } from './BottlePlaceholder'

describe('BottlePlaceholder', () => {
  it('shows the generic icon and "No Photo" label when no name is given', () => {
    render(<BottlePlaceholder />)

    expect(screen.getByText('No Photo')).toBeInTheDocument()
  })

  it('shows initials from the first two words of a multi-word name', () => {
    render(<BottlePlaceholder name="Eagle Rare 10 Year" />)

    expect(screen.getByText('ER')).toBeInTheDocument()
    expect(screen.queryByText('No Photo')).not.toBeInTheDocument()
  })

  it('shows the first two letters of a single-word name', () => {
    render(<BottlePlaceholder name="Blantons" />)

    expect(screen.getByText('BL')).toBeInTheDocument()
  })

  it('skips a purely numeric second word like an age statement', () => {
    render(<BottlePlaceholder name="Redbreast 12" />)

    expect(screen.getByText('RE')).toBeInTheDocument()
  })

  it('falls back to the generic icon when the name is empty or whitespace', () => {
    render(<BottlePlaceholder name="   " />)

    expect(screen.getByText('No Photo')).toBeInTheDocument()
  })
})
