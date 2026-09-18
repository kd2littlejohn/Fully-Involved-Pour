import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { FinishStep } from './FinishStep'
import { blankDraft } from '../draft'

describe('FinishStep', () => {
  it('renders the Finish descriptor chips, the slider, and the notes field', () => {
    render(<FinishStep draft={blankDraft()} updateDraft={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Long' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Oaky' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Other' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Finish notes')).toBeInTheDocument()
  })

  it('toggles a finish tag on and off without touching notes or the slider', async () => {
    const user = userEvent.setup()
    const updateDraft = vi.fn()
    render(<FinishStep draft={blankDraft()} updateDraft={updateDraft} />)

    await user.click(screen.getByRole('button', { name: 'Long' }))
    expect(updateDraft).toHaveBeenCalledWith({ finishTags: ['Long'] })
  })

  it('visibly reflects an already-selected finish tag as active', () => {
    render(<FinishStep draft={{ ...blankDraft(), finishTags: ['Warm'] }} updateDraft={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Warm' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('preserves the existing free-text finish notes behavior', async () => {
    const user = userEvent.setup()
    const updateDraft = vi.fn()
    render(<FinishStep draft={blankDraft()} updateDraft={updateDraft} />)
    await user.type(screen.getByLabelText('Finish notes'), 'x')
    expect(updateDraft).toHaveBeenCalledWith({ finishNotes: 'x' })
  })
})
