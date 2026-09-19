import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from './Slider'

describe('Slider', () => {
  it('renders no hint by default', () => {
    const { container } = render(<Slider id="s" label="Nose" max={2.5} value={1} onChange={vi.fn()} />)
    expect(container.querySelector('p')).not.toBeInTheDocument()
  })

  it('shows guidance text for the current value when describeValue is given', () => {
    render(
      <Slider
        id="s"
        label="Complexity & Balance"
        max={1}
        value={0.9}
        onChange={vi.fn()}
        describeValue={(value, max) => (value / max >= 0.85 ? 'Exceptional' : 'Something else')}
      />,
    )
    expect(screen.getByText('Exceptional')).toBeInTheDocument()
  })

  it('updates the guidance text as the value changes', () => {
    const { rerender } = render(
      <Slider
        id="s"
        label="Complexity & Balance"
        max={1}
        value={0.1}
        onChange={vi.fn()}
        describeValue={(value, max) => (value / max >= 0.85 ? 'Exceptional' : 'Simple')}
      />,
    )
    expect(screen.getByText('Simple')).toBeInTheDocument()

    rerender(
      <Slider
        id="s"
        label="Complexity & Balance"
        max={1}
        value={0.9}
        onChange={vi.fn()}
        describeValue={(value, max) => (value / max >= 0.85 ? 'Exceptional' : 'Simple')}
      />,
    )
    expect(screen.getByText('Exceptional')).toBeInTheDocument()
  })
})
