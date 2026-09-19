import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ComplexityStep } from './ComplexityStep'
import { blankDraft } from '../draft'
import { FIP_MAX } from '../../fip/scoring'

describe('ComplexityStep', () => {
  it('shows guidance for a low complexity value', () => {
    render(<ComplexityStep draft={{ ...blankDraft(), complexity: 0 }} updateDraft={vi.fn()} />)
    expect(screen.getByText(/Simple or one-note/)).toBeInTheDocument()
  })

  it('shows guidance for a near-max complexity value', () => {
    render(<ComplexityStep draft={{ ...blankDraft(), complexity: FIP_MAX.complexity }} updateDraft={vi.fn()} />)
    expect(screen.getByText(/Exceptional/)).toBeInTheDocument()
  })

  it('still renders the buy-again select and notes field', () => {
    render(<ComplexityStep draft={blankDraft()} updateDraft={vi.fn()} />)
    expect(screen.getByLabelText('Would you buy it again?')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('How balanced and layered was this pour?')).toBeInTheDocument()
  })
})
