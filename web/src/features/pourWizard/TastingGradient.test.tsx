import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TastingGradient } from './TastingGradient'

describe('TastingGradient', () => {
  it('renders nothing when there are no tags', () => {
    const { container } = render(<TastingGradient tags={[]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a legend entry for each tag', () => {
    render(<TastingGradient tags={['Vanilla', 'Oak', 'Cherry']} />)
    expect(screen.getByText('Vanilla')).toBeInTheDocument()
    expect(screen.getByText('Oak')).toBeInTheDocument()
    expect(screen.getByText('Cherry')).toBeInTheDocument()
  })
})
