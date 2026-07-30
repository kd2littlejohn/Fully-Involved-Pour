import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddBottleForm } from './AddBottleForm'

const mockLookup = vi.fn()
const mockScan = vi.fn()

vi.mock('../../data/repositories/ai', () => ({
  lookupBottleInfo: (...args: unknown[]) => mockLookup(...args),
  scanBottleLabel: (...args: unknown[]) => mockScan(...args),
}))

vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ user: { uid: 'u1' }, loading: false }),
}))

beforeEach(() => {
  mockLookup.mockReset()
  mockScan.mockReset()
})

describe('AddBottleForm', () => {
  it('fills distillery/type/proof from AI lookup when asked', async () => {
    mockLookup.mockResolvedValue({ known: true, distillery: 'Buffalo Trace', type: 'Bourbon', region: 'Kentucky', proof: 90 })
    render(<AddBottleForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Bottle name'), 'Eagle Rare 10 Year')
    await userEvent.click(screen.getByRole('button', { name: '✨ Ask AI' }))

    expect(mockLookup).toHaveBeenCalledWith('Eagle Rare 10 Year')
    expect(await screen.findByDisplayValue('Buffalo Trace')).toBeInTheDocument()
    expect(screen.getByDisplayValue('Bourbon')).toBeInTheDocument()
    expect(screen.getByDisplayValue('90')).toBeInTheDocument()
  })

  it('shows a helpful message when the AI has no match', async () => {
    mockLookup.mockResolvedValue({ known: false })
    render(<AddBottleForm onSubmit={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Bottle name'), 'Some Obscure Bottle')
    await userEvent.click(screen.getByRole('button', { name: '✨ Ask AI' }))

    expect(await screen.findByText('No close match yet. Keep typing, or save it manually.')).toBeInTheDocument()
  })

  it('submits the extra AI-sourced fields alongside the basics', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined)
    render(<AddBottleForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    await userEvent.type(screen.getByLabelText('Bottle name'), "Blanton's")
    await userEvent.type(screen.getByLabelText('Age statement (optional)'), '8 Year')
    await userEvent.click(screen.getByRole('button', { name: 'Add Bottle' }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ name: "Blanton's", ageStatement: '8 Year', status: 'sealed' }))
  })
})
