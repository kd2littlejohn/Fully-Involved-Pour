import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { InfinityBottleHeader } from './InfinityBottleHeader'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}))

describe('InfinityBottleHeader', () => {
  it('renders the title and navigates to backTo when Back is clicked', async () => {
    render(<InfinityBottleHeader backTo="/collection/infinity" title="Tastings" />)
    expect(screen.getByText('Tastings')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(mockNavigate).toHaveBeenCalledWith('/collection/infinity')
  })

  it('renders an optional action slot', () => {
    render(<InfinityBottleHeader backTo="/collection/infinity" title="Tastings" action={<span>Extra</span>} />)
    expect(screen.getByText('Extra')).toBeInTheDocument()
  })
})
